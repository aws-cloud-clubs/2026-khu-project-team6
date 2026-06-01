# Design Document

## Overview

HARUMAN 렌탈 플랫폼용 초경량 WebSocket 채팅 서버의 구현 설계. 단일 Node.js 파일(`ws-chat-server.js`)로 구성되며, 순정 `ws` 모듈 기반으로 1GB RAM / 1 vCPU 마이크로 EC2 인스턴스에서 500개 동시 접속을 처리한다.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                   ws-chat-server.js                       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  WebSocket    │  │  Heartbeat   │  │   Clean_Bot   │ │
│  │  Server (ws)  │  │  Manager     │  │  (Bedrock     │ │
│  │              │  │  (setInterval)│  │   Singleton)  │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                  │                   │         │
│  ┌──────┴──────────────────┴───────────────────┴──────┐ │
│  │              Event Loop (Single Thread)              │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │         Background Write Queue (fire-and-forget)     │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   Supabase PostgreSQL  │
              │   (chat_rooms,         │
              │    chat_messages,       │
              │    ws_connections)      │
              └───────────────────────┘
```

### Data Flow

1. **Connection**: Client → WS Upgrade → JWT 검증 → ws.userId/ws.roomId 바인딩 → Background_Write(ws_connections INSERT)
2. **Message**: Client → JSON parse → Clean_Bot 검열 → Broadcast to room → Background_Write(chat_messages INSERT)
3. **Heartbeat**: setInterval → ping all clients → pong 미응답 시 terminate() → Background_Write(ws_connections DELETE)
4. **Disconnect**: close/error event → Background_Write(ws_connections DELETE)

## Components and Interfaces

### WebSocket Server Component

```javascript
// ws-chat-server.js - 단일 파일 내 모든 컴포넌트 포함

// Interface: Server Bootstrap
function startServer(port) → WebSocketServer

// Interface: Connection Handler
function onConnection(ws, req) → void

// Interface: Message Handler
function onMessage(ws, data) → void
```

### Clean Bot Component

```javascript
// Interface: Message Moderation
async function moderateMessage(content: string) → "PASSED" | "BANNED"

// Singleton: BedrockRuntimeClient (created once at startup)
const bedrockClient = new BedrockRuntimeClient({ region: 'ap-northeast-2' })
```

### Background Write Component

```javascript
// Interface: Fire-and-forget DB write
function bgWrite(promise: Promise<any>) → void
// Catches errors internally, never throws to caller
```

### Heartbeat Manager Component

```javascript
// Interface: Heartbeat lifecycle
function startHeartbeat(wss: WebSocketServer, intervalMs: number) → NodeJS.Timer
function stopHeartbeat(timer: NodeJS.Timer) → void
```

### Broadcast Component

```javascript
// Interface: Room-scoped message delivery
function broadcast(roomId: string, message: string, excludeWs?: WebSocket) → void
```

## Data Models

### ws_connections Table

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| connection_id | varchar | PK | 고유 연결 식별자 |
| user_id | uuid | NOT NULL | 연결된 사용자 ID |
| connected_at | timestamptz | NOT NULL | 연결 시각 |
| last_ping_at | timestamptz | NOT NULL | 마지막 pong 수신 시각 |

### chat_rooms Table

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | uuid | PK | 채팅방 ID |
| rental_id | uuid | NOT NULL | 대여 ID |
| seller_id | uuid | NOT NULL | 판매자 ID |
| buyer_id | uuid | NOT NULL | 구매자 ID |

### chat_messages Table

| Column | Type | Constraint | Description |
|--------|------|-----------|-------------|
| id | uuid | PK, auto-gen | 메시지 ID |
| room_id | uuid | FK → chat_rooms.id | 채팅방 ID |
| sender_id | uuid | NOT NULL | 발신자 ID |
| content | text | NOT NULL | 메시지 내용 |
| clean_bot_status | varchar | NOT NULL | "PASSED" 또는 "BANNED" |
| warning_count | int4 | NOT NULL, default 0 | 경고 횟수 |
| sent_at | timestamptz | NOT NULL | 전송 시각 |

### WebSocket Object In-Memory Model

```javascript
// ws 객체에 바인딩되는 최소 원시값
ws.userId   // string (uuid) - 인증된 사용자 ID
ws.roomId   // string (uuid) - 참여 중인 채팅방 ID
ws.isAlive  // boolean - heartbeat 응답 상태
```

### Message Protocol (Client ↔ Server JSON)

```json
// Client → Server: 채팅 메시지 전송
{ "type": "chat", "content": "안녕하세요" }

// Server → Client: 메시지 수신 (PASSED)
{ "type": "chat", "senderId": "uuid", "content": "안녕하세요", "sentAt": "2025-01-01T00:00:00Z" }

// Server → Client: 메시지 수신 (BANNED)
{ "type": "chat", "senderId": "uuid", "content": "클린봇에 의해 차단된 메시지입니다.", "sentAt": "2025-01-01T00:00:00Z", "banned": true }

// Server → Client: 에러
{ "type": "error", "message": "권한이 없습니다." }

// Server → Client: 연결 성공
{ "type": "connected", "userId": "uuid", "roomId": "uuid" }
```

## Error Handling

| Error Scenario | Handling Strategy | User Impact |
|---------------|-------------------|-------------|
| JWT 인증 실패 | ws.close(4001, "Unauthorized") | 연결 거부 |
| 채팅방 권한 없음 | ws.close(4003, "Forbidden") | 연결 거부 |
| 잘못된 JSON 메시지 | 에러 메시지 전송, 연결 유지 | 해당 메시지만 무시 |
| Clean Bot 타임아웃 (5초) | "PASSED"로 fallback | 메시지 정상 전달 |
| Clean Bot 호출 실패 | "PASSED"로 fallback, 에러 로깅 | 메시지 정상 전달 |
| Supabase INSERT 실패 | bgWrite 내부 에러 로깅 | 메시지 전달에 영향 없음 |
| Supabase DELETE 실패 | bgWrite 내부 에러 로깅 | 고스트 레코드 잔존 가능 |
| 메모리 임계값 초과 | 새 연결 거부, 경고 로그 | 기존 연결 유지, 신규 연결 불가 |
| 프로세스 SIGTERM | graceful shutdown | 모든 연결 정상 종료 |

## Testing Strategy

### Unit Testing

- bgWrite 함수: Promise 실패 시 throw하지 않는지 검증
- broadcast 함수: roomId 필터링 정확성 검증
- Clean Bot 응답 파싱: "PASSED"/"BANNED" 추출 로직 검증
- 메모리 체크 로직: 임계값 초과/미만 분기 검증

### Integration Testing

- WebSocket 연결 → 인증 → 메시지 전송 → 브로드캐스트 전체 흐름
- Heartbeat에 의한 고스트 커넥션 정리
- Clean Bot PASSED/BANNED 분기 동작

### Load Testing

- 500개 동시 WebSocket 클라이언트 연결 스크립트
- 메모리 사용량 모니터링 (1GB 이내 유지 확인)
- 브로드캐스트 지연 시간 측정 (50ms 이내)

## Correctness Properties

### Property 1: Broadcast Isolation
- **Validates: Requirements 7.4, 7.5**
- **Type**: Invariant
- **Description**: 브로드캐스트는 동일 roomId를 가진 연결에만 전달된다
- **Formal**: FOR ALL messages m broadcast to room R, EVERY recipient ws has ws.roomId === R

### Property 2: Background Write Non-Blocking
- **Validates: Requirements 3.1, 3.4**
- **Type**: Invariant
- **Description**: Background_Write 실패가 메시지 전송 흐름을 중단하지 않는다
- **Formal**: FOR ALL Background_Write operations, failure does NOT throw to the caller's execution context

### Property 3: Heartbeat Termination Completeness
- **Validates: Requirements 4.2, 4.3**
- **Type**: Invariant
- **Description**: ping 응답이 없는 연결은 다음 heartbeat 주기에 반드시 terminate된다
- **Formal**: FOR ALL ws where ws.isAlive === false at ping time, ws.terminate() is called

### Property 4: Clean Bot Verdict Determinism
- **Validates: Requirements 5.4**
- **Type**: Metamorphic
- **Description**: Clean_Bot은 항상 "PASSED" 또는 "BANNED" 중 하나만 반환한다
- **Formal**: FOR ALL messages, cleanBot(message) ∈ {"PASSED", "BANNED"}

### Property 5: Connection Lifecycle Consistency
- **Validates: Requirements 2.3, 2.4**
- **Type**: Round-trip
- **Description**: 연결 생성 시 ws_connections에 INSERT되고, 연결 종료 시 반드시 DELETE된다
- **Formal**: FOR ALL connections, connect → INSERT ws_connections AND (disconnect OR terminate) → DELETE ws_connections

### Property 6: BANNED Message Content Replacement
- **Validates: Requirements 6.3, 6.5**
- **Type**: Invariant
- **Description**: BANNED 판정 메시지는 원본 content가 수신자에게 절대 전달되지 않는다
- **Formal**: FOR ALL messages where verdict === "BANNED", broadcast content === "클린봇에 의해 차단된 메시지입니다."

### Property 7: Singleton Reuse
- **Validates: Requirements 1.3, 1.4, 5.1**
- **Type**: Idempotence
- **Description**: BedrockRuntimeClient와 Supabase_Client는 서버 수명 동안 단 1개 인스턴스만 존재한다
- **Formal**: FOR ALL invocations, getBedrockClient() returns the same reference AND getSupabaseClient() returns the same reference

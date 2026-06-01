# Requirements Document

## Introduction

HARUMAN 렌탈 플랫폼의 초경량 WebSocket 채팅 서버. 단일 마이크로 EC2 인스턴스(1GB RAM, 1 vCPU, 월 $30 예산)에서 500개 동시 접속을 안정적으로 처리하는 단일 Node.js 파일 기반 실시간 채팅 서버를 구현한다. 순정 `ws` 라이브러리를 사용하며, AWS Bedrock Nova Lite 기반 클린봇 검열과 Supabase PostgreSQL 연동을 포함한다.

## Glossary

- **Chat_Server**: 순정 ws 모듈 기반 WebSocket 채팅 서버 프로세스
- **WS_Connection**: 개별 WebSocket 연결 객체 (ws 인스턴스)
- **Chat_Room**: seller와 buyer 간 1:1 채팅방 (chat_rooms 테이블)
- **Chat_Message**: 채팅 메시지 레코드 (chat_messages 테이블)
- **Connection_Registry**: ws_connections 테이블에 저장되는 활성 연결 정보
- **Clean_Bot**: AWS Bedrock Nova Lite 기반 메시지 검열 싱글톤 모듈
- **Heartbeat_Manager**: 주기적 ping/pong 기반 고스트 커넥션 감지 및 회수 모듈
- **Supabase_Client**: Supabase PostgreSQL 데이터베이스 클라이언트
- **Background_Write**: await 없이 비동기로 실행되는 DB 쓰기 작업 (fire-and-forget)
- **Broadcast**: 동일 채팅방 내 모든 활성 연결에 메시지를 전송하는 동작

## Requirements

### Requirement 1: 순정 ws 모듈 기반 서버 초기화

**User Story:** As a platform operator, I want the chat server to run as a single Node.js file using the raw ws library, so that it can be deployed on a micro EC2 instance with minimal resource overhead.

#### Acceptance Criteria

1. THE Chat_Server SHALL use the native `ws` npm module as the sole WebSocket implementation
2. THE Chat_Server SHALL initialize as a single executable Node.js file without external framework dependencies (Socket.io, Express-ws 등 제외)
3. WHEN the Chat_Server starts, THE Chat_Server SHALL create a single BedrockRuntimeClient instance (singleton) with region "ap-northeast-2" and modelId "arn:aws:bedrock:ap-northeast-2::inference-profile/amazon.nova-lite-v1:0"
4. WHEN the Chat_Server starts, THE Chat_Server SHALL create a single Supabase_Client instance (singleton) for database operations
5. THE Chat_Server SHALL listen on a configurable port (default 8080) for incoming WebSocket connections

### Requirement 2: 최소 메모리 바인딩 연결 관리

**User Story:** As a platform operator, I want each WebSocket connection to carry only minimal primitive metadata, so that 500 concurrent connections fit within 1GB RAM.

#### Acceptance Criteria

1. WHEN a client establishes a WebSocket connection, THE Chat_Server SHALL bind only primitive values (ws.roomId, ws.userId) directly to the ws object
2. THE Chat_Server SHALL NOT maintain heavy array or object structures in memory per connection
3. WHEN a client connects with a valid authentication token, THE Chat_Server SHALL record the connection in the ws_connections table with fields: connection_id (varchar, PK), user_id (uuid), connected_at (timestamptz), last_ping_at (timestamptz)
4. WHEN a client disconnects, THE Chat_Server SHALL immediately delete the corresponding record from the ws_connections table via Background_Write
5. THE Chat_Server SHALL support a minimum of 500 concurrent WS_Connection instances without process crash or OOM (Out of Memory) error

### Requirement 3: CPU/DB 비블로킹 처리

**User Story:** As a platform operator, I want all database writes to be non-blocking fire-and-forget operations, so that message broadcast latency is not affected by DB I/O.

#### Acceptance Criteria

1. WHEN a Chat_Message is saved to the database, THE Chat_Server SHALL execute the Supabase insert as a Background_Write (without await) to avoid blocking the event loop
2. WHEN a WS_Connection record is inserted or deleted, THE Chat_Server SHALL execute the operation as a Background_Write
3. THE Chat_Server SHALL isolate the message Broadcast loop from all database I/O operations
4. WHEN a Background_Write fails, THE Chat_Server SHALL log the error to console without interrupting message delivery
5. THE Chat_Server SHALL process incoming messages and broadcast responses without waiting for database confirmation

### Requirement 4: 하트비트 기반 고스트 커넥션 회수

**User Story:** As a platform operator, I want the server to proactively detect and terminate dead connections, so that ghost connections do not consume server resources.

#### Acceptance Criteria

1. THE Heartbeat_Manager SHALL send a WebSocket ping frame to every active WS_Connection at a fixed interval (configurable, default 30 seconds)
2. WHEN a WS_Connection fails to respond with a pong within one ping interval, THE Heartbeat_Manager SHALL call ws.terminate() on that connection
3. WHEN the Heartbeat_Manager terminates a ghost connection, THE Chat_Server SHALL delete the corresponding ws_connections record via Background_Write
4. WHEN a WS_Connection receives a pong response, THE Heartbeat_Manager SHALL update the last_ping_at field in the ws_connections table via Background_Write
5. THE Heartbeat_Manager SHALL start automatically when the Chat_Server starts and stop when the Chat_Server shuts down

### Requirement 5: 클린봇 검열 싱글톤 최적화

**User Story:** As a platform operator, I want the clean bot to use a single Bedrock client instance with minimal token generation, so that moderation latency and cost are minimized.

#### Acceptance Criteria

1. THE Clean_Bot SHALL reuse a single BedrockRuntimeClient instance created at server startup (singleton pattern)
2. THE Clean_Bot SHALL invoke the model with inferenceConfig: maxTokens: 5, temperature: 0.0
3. THE Clean_Bot SHALL use the system prompt: "너는 실시간 거래 채팅방의 엄격한 AI 클린봇 검열관이야. 입력된 메시지에 심각한 비속어, 욕설, 성인물, 혹은 외부 결제 유도 사기 징후가 확실히 포함되어 있다면 오직 BANNED만 반환해라. 안전한 소통 문장이라면 오직 PASSED만 반환해라. 다른 설명은 절대 붙이지 마라."
4. WHEN a message is submitted for moderation, THE Clean_Bot SHALL return either "PASSED" or "BANNED" as the verdict
5. IF the Clean_Bot invocation fails or times out, THEN THE Chat_Server SHALL treat the message as "PASSED" and proceed with delivery

### Requirement 6: 검열 결과에 따른 메시지 처리 및 전송

**User Story:** As a chat user, I want messages to be moderated in real-time so that harmful content is blocked before reaching other participants.

#### Acceptance Criteria

1. WHEN the Clean_Bot returns "PASSED", THE Chat_Server SHALL save the message to chat_messages with clean_bot_status: "PASSED" and warning_count: 0 via Background_Write
2. WHEN the Clean_Bot returns "PASSED", THE Chat_Server SHALL immediately broadcast the original content to all WS_Connection instances in the same Chat_Room
3. WHEN the Clean_Bot returns "BANNED", THE Chat_Server SHALL replace the message content with "클린봇에 의해 차단된 메시지입니다."
4. WHEN the Clean_Bot returns "BANNED", THE Chat_Server SHALL save the message to chat_messages with clean_bot_status: "BANNED" and warning_count: 1 via Background_Write
5. WHEN the Clean_Bot returns "BANNED", THE Chat_Server SHALL broadcast the replacement text "클린봇에 의해 차단된 메시지입니다." to all WS_Connection instances in the same Chat_Room

### Requirement 7: 채팅방 라우팅 및 인증

**User Story:** As a chat user, I want to join my rental chat room securely, so that only authorized seller and buyer can exchange messages.

#### Acceptance Criteria

1. WHEN a client sends a join message with a room_id, THE Chat_Server SHALL verify that the user_id matches either seller_id or buyer_id in the chat_rooms table
2. IF a client attempts to join a Chat_Room without valid authorization, THEN THE Chat_Server SHALL reject the connection with an error message and close the socket
3. WHEN a client successfully joins a Chat_Room, THE Chat_Server SHALL bind the room_id as ws.roomId on the WS_Connection object
4. THE Chat_Server SHALL route incoming messages only to WS_Connection instances sharing the same ws.roomId value
5. WHEN a Broadcast occurs, THE Chat_Server SHALL iterate only over connections with matching ws.roomId (not all server connections)

### Requirement 8: Supabase 테이블 스키마 준수

**User Story:** As a developer, I want the server to conform to the predefined Supabase table schemas, so that it integrates seamlessly with the existing HARUMAN platform.

#### Acceptance Criteria

1. THE Chat_Server SHALL read and write to the chat_rooms table with columns: id (uuid), rental_id (uuid), seller_id (uuid), buyer_id (uuid)
2. THE Chat_Server SHALL read and write to the chat_messages table with columns: id (uuid), room_id (uuid), sender_id (uuid), content (text), clean_bot_status (varchar), warning_count (int4), sent_at (timestamptz)
3. THE Chat_Server SHALL read and write to the ws_connections table with columns: connection_id (varchar, PK), user_id (uuid), connected_at (timestamptz), last_ping_at (timestamptz)
4. WHEN inserting a chat_messages record, THE Chat_Server SHALL set sent_at to the current UTC timestamp in ISO 8601 format
5. WHEN inserting a ws_connections record, THE Chat_Server SHALL generate a unique connection_id string for the primary key

### Requirement 9: 리소스 제약 준수

**User Story:** As a platform operator, I want the server to operate within strict resource constraints, so that it runs reliably on a $30/month micro EC2 instance.

#### Acceptance Criteria

1. THE Chat_Server SHALL operate within 1GB RAM and 1 vCPU without degradation under 500 concurrent connections
2. THE Chat_Server SHALL complete message broadcast to all room participants within 50ms under normal load (excluding Clean_Bot latency)
3. THE Chat_Server SHALL NOT spawn child processes or worker threads for message handling
4. THE Chat_Server SHALL gracefully handle connection spikes by queuing incoming upgrade requests rather than crashing
5. IF the process memory usage exceeds 900MB, THEN THE Chat_Server SHALL log a warning and reject new connections until memory drops below the threshold

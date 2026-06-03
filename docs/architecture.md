# HARUMAN 시스템 아키텍처

## 전체 인프라 구조도

```mermaid
flowchart TB
    %% ─── 클라이언트 ───────────────────────────────────────────
    subgraph Client["👤 Client (Browser/Mobile)"]
        ReactApp["React SPA<br/>(Vite + TypeScript)"]
    end

    %% ─── CDN & 정적 호스팅 ────────────────────────────────────
    subgraph StaticHosting["☁️ AWS - 정적 호스팅 (비용 ~$0)"]
        CF["CloudFront CDN"]
        S3_Static["S3 Bucket<br/>(Frontend Build)"]
    end

    %% ─── API 레이어 ──────────────────────────────────────────
    subgraph APILayer["☁️ AWS - API 서버리스 ($30 미만 핵심)"]
        APIGW["API Gateway<br/>(REST + WebSocket)"]
        Lambda_Auth["Lambda<br/>Authorizer<br/>(JWT 검증)"]
        Lambda_Express["Lambda<br/>Express Handler<br/>(인증/상품/대여/결제)"]
        Lambda_Chat["Lambda<br/>sendMessage<br/>(채팅 + CleanBot)"]
    end

    %% ─── AI 서비스 ───────────────────────────────────────────
    subgraph AIService["🤖 AWS Bedrock (서울 리전)"]
        Bedrock["Nova Lite v1<br/>(AI 추천 + 채팅 검열)"]
        Timeout["Promise.race<br/>5초 타임아웃"]
    end

    %% ─── WebSocket 채팅 서버 ─────────────────────────────────
    subgraph ChatServer["💬 EC2 - 채팅 (t4g.nano/micro)"]
        EC2_WS["WebSocket Server<br/>(ws 라이브러리)"]
        WSConnect["$connect → JWT 검증"]
        WSDisconnect["$disconnect → 정리"]
    end

    %% ─── 데이터베이스 ────────────────────────────────────────
    subgraph Database["🗄️ Supabase (Free Tier)"]
        SupaAuth["Supabase Auth<br/>(회원 인증/세션)"]
        SupaDB["PostgreSQL<br/>(users, items, rentals,<br/>chat_rooms, chat_messages,<br/>notifications, cards)"]
        SupaRealtime["Realtime<br/>(변경 감지)"]
    end

    %% ─── 외부 서비스 ────────────────────────────────────────
    subgraph External["📧 외부 서비스"]
        Resend["Resend SMTP<br/>(이메일 인증 발송)"]
    end

    %% ─── 모니터링 ───────────────────────────────────────────
    subgraph Monitoring["📊 모니터링"]
        Prometheus["Prometheus<br/>(GET /metrics 스크래핑)"]
        Grafana["Grafana Dashboard<br/>(레이턴시/에러율/연결수)"]
    end

    %% ─── 연결 관계 ──────────────────────────────────────────
    ReactApp -->|"HTTPS"| CF
    CF --> S3_Static
    ReactApp -->|"REST API"| APIGW
    ReactApp -->|"WebSocket"| EC2_WS

    APIGW --> Lambda_Auth
    Lambda_Auth -->|"Allow/Deny"| APIGW
    APIGW --> Lambda_Express
    APIGW --> Lambda_Chat

    Lambda_Express -->|"5초 timeout"| Bedrock
    Lambda_Chat -->|"CleanBot 검열"| Bedrock
    Bedrock -.->|"타임아웃 시 fallback"| Timeout

    Lambda_Express --> SupaDB
    Lambda_Express --> SupaAuth
    Lambda_Chat --> SupaDB
    Lambda_Chat -->|"푸시 알림"| EC2_WS

    EC2_WS --> WSConnect
    EC2_WS --> WSDisconnect
    EC2_WS --> SupaDB

    Lambda_Express -->|"인증 메일"| Resend

    Lambda_Express -.->|"/metrics"| Prometheus
    Prometheus --> Grafana
```

## 데이터 흐름 상세

```mermaid
sequenceDiagram
    participant U as 사용자
    participant FE as React (CloudFront)
    participant GW as API Gateway
    participant AUTH as Lambda Authorizer
    participant API as Express Lambda
    participant AI as Bedrock Nova Lite
    participant DB as Supabase PostgreSQL
    participant WS as EC2 WebSocket
    participant MAIL as Resend

    %% 회원가입 흐름
    Note over U,MAIL: 📝 회원가입 + 이메일 인증
    U->>FE: 이메일 입력
    FE->>GW: POST /auth/send-verification
    GW->>API: (인증 불필요)
    API->>DB: users INSERT (미인증)
    API->>MAIL: 인증 메일 발송 (Resend)
    MAIL-->>U: 이메일 수신 → 링크 클릭
    U->>API: GET /auth/confirm?token=xxx
    API->>DB: is_verified = true
    API-->>U: 302 Redirect → /signup

    %% AI 추천 흐름
    Note over U,AI: 🤖 AI 물품 추천
    U->>FE: "캠핑 갈 건데 뭐 빌려?"
    FE->>GW: POST /ai/chat
    GW->>AUTH: JWT 검증
    AUTH-->>GW: Allow (userId in context)
    GW->>API: message 전달
    API->>AI: InvokeModel (5초 타임아웃)
    alt 정상 응답
        AI-->>API: {"reply":"...", "suggestedItemTypes":[...]}
        API-->>FE: 추천 결과
    else 타임아웃
        API-->>FE: fallback 메시지
    end

    %% 채팅 흐름
    Note over U,WS: 💬 실시간 채팅
    U->>WS: WebSocket connect (?token=JWT)
    WS->>DB: ws_connections INSERT
    WS-->>U: 연결 완료
    U->>WS: sendMessage {roomId, content}
    WS->>AI: CleanBot 검열
    AI-->>WS: PASSED / BANNED
    alt PASSED
        WS->>DB: chat_messages INSERT
        WS->>WS: 상대방 WebSocket push
        WS->>DB: notifications INSERT
    else BANNED
        WS-->>U: clean_bot_warning
    end
```

## 비용 구조 ($30/월 미만)

```mermaid
pie title 월간 예상 비용 분배
    "Lambda (API 서버)" : 8
    "API Gateway" : 3
    "EC2 t4g.nano (채팅)" : 4
    "Bedrock Nova Lite" : 10
    "CloudFront + S3" : 1
    "Supabase Free" : 0
    "Resend Free" : 0
    "기타 (데이터 전송)" : 2
```

| 서비스 | 요금 | 비고 |
|--------|------|------|
| Lambda | ~$8 | 월 100만 요청 기준 |
| API Gateway | ~$3 | REST + WebSocket |
| EC2 t4g.nano | ~$4 | 프리티어 or $3.80/월 |
| Bedrock Nova Lite | ~$10 | 입출력 토큰 기반 |
| S3 + CloudFront | ~$1 | 정적 파일 서빙 |
| Supabase | $0 | Free Tier (500MB) |
| Resend | $0 | Free Tier (100통/일) |
| **합계** | **~$28** | **$30 미만 ✓** |

## 핵심 설계 원칙

1. **서버리스 우선**: Express를 Lambda에 올려 idle 비용 제로
2. **WebSocket은 EC2**: Lambda의 연결 제한(최대 10분)을 우회하여 지속 연결 보장
3. **AI 타임아웃 방어**: 5초 `Promise.race`로 Bedrock 지연이 전체 시스템에 전파되지 않도록 차단
4. **Prometheus 메트릭**: `/metrics` 엔드포인트로 Grafana 실시간 모니터링
5. **Supabase Free Tier 최적화**: Auth + DB를 하나의 무료 인스턴스로 통합

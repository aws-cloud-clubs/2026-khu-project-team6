# Requirements Document

## Introduction

HARUMAN 렌탈 플랫폼의 유저 간 실시간 채팅 메시지를 REST API 엔드포인트(`/api/chat/send`)를 통해 수신하고, AWS Bedrock Nova Lite 모델을 사용하여 실시간 검열(Moderation)을 수행하는 기능이다. 기존 WebSocket 기반 `sendMessage` 핸들러의 REST API 대안으로, 프론트엔드에서 `roomId`, `senderId`, `message`를 전달받아 Nova Lite로 검열 후 결과에 따라 Supabase `chat_messages` 테이블에 저장한다.

## Glossary

- **Moderation_Router**: `/api/chat/send` REST API 엔드포인트를 처리하는 Lambda 핸들러
- **Nova_Lite_Client**: 서울 리전(`ap-northeast-2`)의 AWS Bedrock Runtime을 통해 `amazon.nova-lite-v1:0` 모델을 호출하는 클라이언트
- **Moderation_Prompt**: Nova Lite에 전달되는 검열 전용 시스템 프롬프트 (페르소나 및 규칙 포함)
- **Chat_Message**: Supabase `chat_messages` 테이블에 저장되는 채팅 메시지 레코드
- **Moderation_Verdict**: Nova Lite가 반환하는 검열 판정 결과 (`PASSED` 또는 `BANNED`)
- **Blocked_Message**: 검열에 의해 차단된 메시지를 대체하는 안내 문구 ("클린봇에 의해 차단된 메시지입니다.")
- **Supabase_Client**: Supabase PostgreSQL 데이터베이스와 통신하는 서버 측 클라이언트

## Requirements

### Requirement 1: REST API 엔드포인트 입력 수신

**User Story:** As a 프론트엔드 개발자, I want `/api/chat/send` 엔드포인트로 채팅 메시지를 전송할 수 있는 REST API, so that WebSocket 없이도 채팅 메시지를 서버에 전달할 수 있다.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/chat/send` with a valid JSON body containing `roomId` (string, 1–64 characters), `senderId` (string, 1–64 characters), and `message` (string, 1–1000 characters after trimming), THE Moderation_Router SHALL extract the three fields and proceed to moderation
2. IF `roomId` is missing or not a string, THEN THE Moderation_Router SHALL return HTTP 422 with a JSON error response containing an error message indicating roomId is required
3. IF `senderId` is missing or not a string, THEN THE Moderation_Router SHALL return HTTP 422 with a JSON error response containing an error message indicating senderId is required
4. IF `message` is missing, not a string, or an empty string after trimming, THEN THE Moderation_Router SHALL return HTTP 422 with a JSON error response containing an error message indicating message content is required
5. IF `message` exceeds 1000 characters after trimming, THEN THE Moderation_Router SHALL return HTTP 422 with a JSON error response containing an error message indicating the maximum message length has been exceeded
6. IF the request body is not valid JSON, THEN THE Moderation_Router SHALL return HTTP 400 with a JSON error response containing an error message indicating the request body format is invalid

---

### Requirement 2: Nova Lite 실시간 검열 호출

**User Story:** As a 플랫폼 운영자, I want 채팅 메시지가 저장되기 전에 Nova Lite AI로 실시간 검열을 수행, so that 욕설, 비하, 성인물, 금융 사기 메시지가 사전에 차단된다.

#### Acceptance Criteria

1. WHEN a valid message is received, THE Nova_Lite_Client SHALL invoke the `amazon.nova-lite-v1:0` model in the `ap-northeast-2` region before storing the message
2. THE Moderation_Prompt SHALL include the persona "너는 실시간 채팅방의 엄격한 보안 검열관이야." as the system prompt
3. THE Moderation_Prompt SHALL include the rule instructing the model to return only `BANNED` for messages containing profanity, disparagement, adult content, or financial fraud, and only `PASSED` for clean messages, with no additional text in the response
4. THE Nova_Lite_Client SHALL set `inferenceConfig` with `maxTokens: 10` and `temperature: 0.0` to maximize response speed and determinism
5. WHEN the Nova Lite model returns a response, THE Moderation_Router SHALL parse the response body and extract the verdict text trimmed of whitespace

---

### Requirement 3: 검열 결과에 따른 메시지 저장 처리

**User Story:** As a 채팅 사용자, I want 안전한 메시지만 채팅방에 표시되고 유해 메시지는 차단 안내로 대체, so that 불쾌한 콘텐츠 없이 안전하게 채팅할 수 있다.

#### Acceptance Criteria

1. WHEN the Moderation_Verdict is `PASSED`, THE Moderation_Router SHALL insert the original `message` into the Supabase `chat_messages` table with `roomId`, `senderId`, `clean_bot_status` set to "clean", and `sent_at` set to the current UTC timestamp
2. WHEN the Moderation_Verdict is `BANNED`, THE Moderation_Router SHALL insert "클린봇에 의해 차단된 메시지입니다." into the Supabase `chat_messages` table instead of the original message, with `clean_bot_status` set to "banned"
3. WHEN the message is successfully inserted into Supabase, THE Moderation_Router SHALL return HTTP 200 with a response body containing the stored message `messageId` and `sentAt` timestamp
4. IF the Supabase insert operation fails, THEN THE Moderation_Router SHALL return HTTP 500 with an error message indicating message storage failure and SHALL NOT expose internal database error details in the response
5. IF the Moderation_Verdict is `FAILED` due to moderation service timeout or error, THEN THE Moderation_Router SHALL insert the original message into the Supabase `chat_messages` table with `clean_bot_status` set to "failed" and proceed as if the verdict were `PASSED`

---

### Requirement 4: Nova Lite 호출 오류 처리

**User Story:** As a 시스템 관리자, I want Nova Lite 호출 실패 시에도 서비스가 중단되지 않는 안정적인 처리, so that AI 서비스 장애가 채팅 기능 전체를 마비시키지 않는다.

#### Acceptance Criteria

1. IF the Nova_Lite_Client call fails due to a network error or timeout, THEN THE Moderation_Router SHALL log the error details including timestamp, error type, and affected room identifier, and allow the message to pass through with a moderation status of `failed`
2. IF the Nova Lite response cannot be parsed or the verdict does not contain `PASSED` or `BANNED`, THEN THE Moderation_Router SHALL treat the moderation result as `failed`, log the unparseable response details, and allow the message to pass through without blocking
3. THE Nova_Lite_Client SHALL enforce a request timeout of 5 seconds for each moderation call, after which the call is cancelled and treated as a failure
4. WHILE the Nova_Lite_Client is experiencing repeated failures, THE Moderation_Router SHALL continue accepting and delivering chat messages with moderation status `failed` rather than rejecting them

---

### Requirement 5: 응답 형식 및 실시간 UI 연동

**User Story:** As a 프론트엔드 개발자, I want 일관된 JSON 응답 형식을 받아 UI를 업데이트, so that 메시지 전송 결과를 사용자에게 즉시 피드백할 수 있다.

#### Acceptance Criteria

1. WHEN a message is successfully stored, THE Moderation_Router SHALL return a JSON response containing `success: true`, the `messageId` (string), the `moderation` verdict (one of `PASSED` or `BANNED`), and the `sentAt` timestamp (ISO 8601 format)
2. WHEN a message is banned by the moderation system, THE Moderation_Router SHALL return the response with `success: true` and `moderation: "BANNED"` so that the frontend can distinguish banned messages from passed messages
3. THE Moderation_Router SHALL include the headers `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type,Authorization`, and `Access-Control-Allow-Methods: POST,OPTIONS` on all responses
4. IF a message fails to store due to a server error, THEN THE Moderation_Router SHALL return a JSON response containing `success: false` and an `error` object with a `code` (string) and `message` (string) field, using HTTP status code 500
5. WHEN the Moderation_Router receives an OPTIONS preflight request, THE Moderation_Router SHALL respond with HTTP status 200 and the CORS headers specified in criterion 3

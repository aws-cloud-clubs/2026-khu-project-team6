# Implementation Plan: Nova Lite Chat Moderation

## Overview

단일 파일(`backend/src/chat/moderationRouter.ts`)에 REST API 검열 핸들러를 구현하고, `main.js`에 라우트를 등록한다. 기존 `cleanbot.ts` 패턴을 참고하되, 엄격한 BANNED/PASSED 전용 시스템 프롬프트와 `maxTokens: 10` 설정으로 최소 응답을 유도한다.

## Tasks

- [ ] 1. Implement moderationRouter.ts core module
  - [ ] 1.1 Create `backend/src/chat/moderationRouter.ts` with validation, moderation, and storage logic
    - Implement `validateRequest(body)` function: extract `roomId` (string, 1–64 chars), `senderId` (string, 1–64 chars), `message` (string, 1–1000 chars after trim)
    - Return 422 with specific error messages for missing/invalid fields, 400 for invalid JSON
    - Implement `moderateWithNovaLite(message)` function: call `amazon.nova-lite-v1:0` in `ap-northeast-2` with system prompt "너는 실시간 채팅방의 엄격한 보안 검열관이야." and rules for BANNED/PASSED only response
    - Set `inferenceConfig: { maxTokens: 10, temperature: 0.0 }`
    - Use `Promise.race` with 5-second timeout, return `FAILED` on timeout/error (fail-open)
    - Implement `parseVerdict(responseText)`: trim text, return `PASSED`/`BANNED` if exact match, else `FAILED`
    - Implement main handler: validate → moderate → store in `chat_messages` table (room_id, sender_id, content, clean_bot_status, sent_at)
    - If verdict is `PASSED` or `FAILED`: store original message with status `clean`/`failed`
    - If verdict is `BANNED`: store "클린봇에 의해 차단된 메시지입니다." with status `banned`
    - Return success response: `{ success: true, messageId, moderation, sentAt }`
    - Return error response on DB failure: `{ success: false, error: { code, message } }` with HTTP 500, no internal details exposed
    - Handle OPTIONS preflight with `corsPreflightResponse()`
    - Use existing `getSupabaseClient()`, `successResponse()`, `errorResponse()`, `corsPreflightResponse()` from common modules
    - Log errors with timestamp, errorType, roomId format
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 1.2 Register the `/api/chat/send` route in `backend/main.js`
    - Import and wire the moderationRouter handler for POST `/api/chat/send`
    - Ensure OPTIONS preflight is handled for the same path
    - _Requirements: 1.1, 5.5_

- [ ] 2. Checkpoint - Verify core implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Property-based tests for moderationRouter
  - [ ]* 3.1 Write property test for valid input acceptance
    - **Property 1: Valid input acceptance**
    - Use fast-check to generate random valid `roomId` (1–64 chars), `senderId` (1–64 chars), `message` (1–1000 chars with non-whitespace)
    - Assert `validateRequest` returns `{ valid: true }` with extracted fields
    - **Validates: Requirements 1.1**

  - [ ]* 3.2 Write property test for invalid input rejection
    - **Property 2: Invalid input rejection**
    - Use fast-check to generate invalid inputs (missing fields, empty strings, >1000 chars, non-string types, non-JSON)
    - Assert `validateRequest` returns `{ valid: false }` with appropriate status code (400 or 422)
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

  - [ ]* 3.3 Write property test for verdict parsing correctness
    - **Property 3: Verdict parsing correctness**
    - Use fast-check to generate random strings; assert only trimmed "PASSED" or "BANNED" return the corresponding verdict, all others return `FAILED`
    - **Validates: Requirements 2.5, 4.2**

  - [ ]* 3.4 Write property test for message storage content determined by verdict
    - **Property 4: Message storage content determined by verdict**
    - For any valid message × 3 verdicts: assert PASSED/FAILED stores original with `clean`/`failed` status, BANNED stores blocked message with `banned` status
    - **Validates: Requirements 3.1, 3.2, 3.5**

  - [ ]* 3.5 Write property test for internal error non-exposure
    - **Property 5: Internal error non-exposure**
    - Generate random DB error messages; assert API error response never contains the original error text
    - **Validates: Requirements 3.4**

  - [ ]* 3.6 Write property test for CORS headers on all responses
    - **Property 6: CORS headers present on all responses**
    - For any request scenario (valid, invalid, error, OPTIONS), assert response includes all 3 CORS headers
    - **Validates: Requirements 5.3, 5.5**

- [ ] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Single new file: `backend/src/chat/moderationRouter.ts`
- Uses existing utilities: `getSupabaseClient()`, `AppError`, `ErrorCodes`, response helpers
- Property tests use fast-check (already in devDependencies)
- Follows existing `cleanbot.ts` pattern for Bedrock calls
- Fail-open policy: any AI failure → message passes through with `failed` status

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"] }
  ]
}
```

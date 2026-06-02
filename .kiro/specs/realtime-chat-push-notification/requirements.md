# Requirements Document

## Introduction

하루만(HARUMAN) 플랫폼의 1:1 채팅에서 상대방이 오프라인(앱 비활성)일 때도 새 메시지를 놓치지 않도록, Firebase Cloud Messaging(FCM)을 활용한 실시간 푸시 알림 기능을 추가한다. 현재 WebSocket 기반 `pushNotification` 함수는 사용자가 WebSocket에 연결된 상태에서만 메시지를 전달할 수 있으므로, 오프라인 사용자에게 도달하기 위해 FCM 디바이스 푸시 알림이 필요하다.

## Glossary

- **FCM_Token_Store**: users 테이블의 `fcm_token` 컬럼으로, 각 사용자의 Firebase Cloud Messaging 디바이스 토큰을 저장하는 저장소
- **Token_Collector**: 프론트엔드에서 Firebase Messaging 라이브러리를 통해 FCM 토큰을 획득하고 백엔드로 전송하는 클라이언트 측 모듈
- **Token_API**: 사용자의 FCM 토큰을 업데이트하는 백엔드 REST 엔드포인트 (PUT /users/fcm-token)
- **Push_Sender**: 메시지 전송 시 수신자의 FCM 토큰을 조회하여 Firebase Admin SDK로 푸시 알림을 발송하는 백엔드 모듈
- **Chat_Room**: 1:1 채팅방으로, seller_id와 buyer_id 두 참여자로 구성된 Direct_Trade 전용 채팅방
- **Sender**: 채팅 메시지를 보내는 사용자
- **Recipient**: 채팅 메시지를 수신하는 상대방 사용자
- **Firebase_Admin_SDK**: Google에서 제공하는 서버 측 Firebase SDK로, 서버에서 FCM 푸시 알림을 전송하는 데 사용

## Requirements

### Requirement 1: FCM 토큰 스키마 확장

**User Story:** As a 백엔드 개발자, I want to users 테이블에 fcm_token 컬럼을 추가하여, so that 각 사용자의 디바이스 푸시 토큰을 저장하고 알림 전송 시 조회할 수 있다.

#### Acceptance Criteria

1. THE FCM_Token_Store SHALL store the fcm_token as a nullable TEXT column in the users table with a default value of NULL
2. WHEN a fcm_token value is stored, THE FCM_Token_Store SHALL accept any non-empty string between 1 and 4096 characters consisting of printable ASCII characters
3. THE FCM_Token_Store SHALL allow multiple users to have NULL as their fcm_token value simultaneously without constraint violation
4. IF a fcm_token value exceeding 4096 characters is provided, THEN THE FCM_Token_Store SHALL reject the value and return a validation error indicating the token exceeds the maximum allowed length
5. WHEN the fcm_token column is added, THE FCM_Token_Store SHALL set all existing user rows to NULL for the fcm_token column without requiring downtime or data migration

### Requirement 2: FCM 토큰 업데이트 API

**User Story:** As a 인증된 사용자, I want to 로그인 시 내 FCM 토큰을 서버에 등록하여, so that 서버가 내 디바이스로 푸시 알림을 전송할 수 있다.

#### Acceptance Criteria

1. WHEN a valid PUT request is received at /users/fcm-token with a JSON body containing a fcm_token string of 1 to 4096 characters, THE Token_API SHALL update the authenticated user's fcm_token column in the users table with the provided value
2. WHEN a PUT request is received at /users/fcm-token without a valid authentication token, THE Token_API SHALL return HTTP 401 with error code UNAUTHORIZED
3. WHEN a PUT request is received at /users/fcm-token with a missing fcm_token field, an empty string, a whitespace-only string, or a string exceeding 4096 characters, THE Token_API SHALL return HTTP 422 with error code VALIDATION_ERROR and a message indicating the validation failure reason
4. WHEN the same user sends multiple PUT requests to /users/fcm-token, THE Token_API SHALL overwrite the previous fcm_token with the latest value (UPSERT behavior)
5. WHEN the fcm_token is successfully stored, THE Token_API SHALL return HTTP 200 with a JSON response body containing a success indicator and the stored fcm_token value
6. IF the database is unavailable or the update operation fails, THEN THE Token_API SHALL return HTTP 500 with error code INTERNAL_ERROR and a message indicating a server-side failure, without exposing internal details

### Requirement 3: 프론트엔드 FCM 토큰 수집

**User Story:** As a 사용자, I want to 앱 접속 시 자동으로 FCM 토큰이 서버에 등록되어, so that 앱을 사용하지 않을 때도 채팅 알림을 받을 수 있다.

#### Acceptance Criteria

1. WHEN a user successfully logs in or navigates to any authenticated route, THE Token_Collector SHALL request browser notification permission via the Notification API
2. IF the user grants notification permission, THEN THE Token_Collector SHALL request an FCM token from the Firebase Messaging library and register a service worker for background message handling
3. WHEN the Token_Collector successfully obtains an FCM token, THE Token_Collector SHALL send the token to the Token_API via PUT /users/fcm-token
4. IF the user denies notification permission, THEN THE Token_Collector SHALL allow the user to continue using the app without push notifications and shall not re-prompt for permission during the same session
5. IF the Firebase Messaging library fails to provide an FCM token, THEN THE Token_Collector SHALL log the error to the browser console and allow the user to continue using the app without push notifications
6. IF the Token_API returns an error during token registration, THEN THE Token_Collector SHALL retry the request once after 5 seconds and log the failure to the browser console without blocking user interaction
7. WHEN the Firebase Messaging library emits a token refresh event, THE Token_Collector SHALL send the updated token to the Token_API via PUT /users/fcm-token
8. WHEN the app is in the foreground and a push notification is received, THE Token_Collector SHALL display the notification as a toast using the app's existing toast component, visible for 5 seconds before auto-dismissing
9. WHILE the app tab is not active or the browser is in the background, WHEN a push notification is received, THE service worker SHALL display a system-level browser notification

### Requirement 4: 메시지 전송 시 푸시 알림 발송

**User Story:** As a 채팅 수신자, I want to 상대방이 메시지를 보내면 푸시 알림을 받아, so that 앱을 열지 않은 상태에서도 새 메시지를 확인할 수 있다.

#### Acceptance Criteria

1. WHEN a chat message is successfully saved to the database, THE Push_Sender SHALL identify the Recipient by selecting the user ID from the Chat_Room that is not equal to the Sender's user ID (i.e., if Sender is seller_id then Recipient is buyer_id, and vice versa)
2. WHEN the Recipient's user ID is identified, THE Push_Sender SHALL query the FCM_Token_Store for the Recipient's fcm_token
3. WHEN the Recipient has a non-NULL fcm_token, THE Push_Sender SHALL send a push notification to the Recipient's device using Firebase_Admin_SDK
4. WHEN the Push_Sender constructs a push notification, THE Push_Sender SHALL set the notification title to the Sender's nickname if the nickname is a non-NULL, non-empty string; IF the Sender's nickname is NULL or empty, THEN THE Push_Sender SHALL set the notification title to '하루만'
5. WHEN the Push_Sender constructs a push notification, THE Push_Sender SHALL set the notification body to the message content truncated to a maximum of 100 characters, appending '…' if the original content exceeds 100 characters
6. WHEN the Recipient's fcm_token is NULL, THE Push_Sender SHALL skip push notification sending without raising an error
7. IF the Firebase_Admin_SDK returns an error during push notification delivery, THEN THE Push_Sender SHALL log the error and continue without affecting the message delivery
8. WHEN a push notification send fails, THE Push_Sender SHALL not modify or delete the chat message in the database, and the existing WebSocket delivery via pushNotification shall remain unaffected by the FCM failure

### Requirement 5: 푸시 알림 안전성 보장

**User Story:** As a 채팅 사용자, I want to 푸시 알림 시스템 장애 시에도 채팅 메시지가 정상 전달되어, so that 푸시 알림 실패로 인해 채팅 기능이 중단되지 않는다.

#### Acceptance Criteria

1. WHEN a chat message is saved to the database, THE Push_Sender SHALL initiate push notification processing without blocking the message send handler's response to the Sender
2. IF an unexpected error occurs during any stage of push notification processing, THEN THE Push_Sender SHALL catch the error, log it, and return without propagating the error to the message send handler, ensuring the message send handler returns a success response
3. IF push notification processing does not complete within 5 seconds, THEN THE Push_Sender SHALL abort the push notification attempt and log a timeout warning without affecting the message delivery status
4. WHEN the Firebase_Admin_SDK returns a token-invalid error (e.g., messaging/registration-token-not-registered or messaging/invalid-registration-token), THE Push_Sender SHALL set the Recipient's fcm_token to NULL in the FCM_Token_Store to prevent repeated delivery failures
5. IF a push notification attempt fails due to a transient error or timeout, THEN THE Push_Sender SHALL not retry the attempt and SHALL proceed without further notification delivery for that message
6. WHEN push notification processing fails or is aborted, THE Push_Sender SHALL ensure the chat message remains persisted in the database with an unchanged delivery status and remains accessible via the WebSocket channel

### Requirement 6: 푸시 알림 데이터 페이로드

**User Story:** As a 프론트엔드 개발자, I want to 푸시 알림에 구조화된 데이터가 포함되어, so that 알림 클릭 시 해당 채팅방으로 바로 이동할 수 있다.

#### Acceptance Criteria

1. THE Push_Sender SHALL include the room_id as a non-empty string value in the push notification data payload
2. THE Push_Sender SHALL include the sender_id as a non-empty string value in the push notification data payload
3. THE Push_Sender SHALL include the message_id as a non-empty string value in the push notification data payload
4. THE Push_Sender SHALL send all data payload values as strings, conforming to the FCM data message format
5. WHEN a user taps the push notification while the app is in the background or terminated, THE Token_Collector SHALL navigate the user to the Chat_Room screen passing the room_id from the data payload as navigation state
6. IF the room_id from the push notification data payload does not correspond to an accessible Chat_Room for the current user, THEN THE Token_Collector SHALL navigate the user to the main screen and display an error message indicating the chat room is unavailable
7. IF the user is not authenticated when tapping the push notification, THEN THE Token_Collector SHALL navigate the user to the login screen and after successful login navigate to the Chat_Room screen using the stored room_id from the data payload

# Requirements Document

## Introduction

HARUMAN은 판매자(대여자)와 구매자(대여받는 자)를 연결하는 P2P/B2C 맞춤형 대여 중개 매칭 플랫폼입니다.
사용자가 필요한 물품 리스트를 체크하면 해당 카테고리 상품만 커스텀하게 노출되며, AI 챗봇이 사용자의 일정과 목적에 맞는 대여 물품을 추천합니다.
에스크로 기반 보증금 정책, 사기 방지 수령 인증, 역할 기반 권한 제어, 실시간 채팅 및 알림 기능을 포함합니다.
AWS Serverless 아키텍처(Lambda, API Gateway, Bedrock, SES)와 Supabase PostgreSQL을 기반으로 구축되며, 월 $30 이하의 비용 제약을 준수합니다.

---

## Glossary

- **Platform**: HARUMAN 대여 중개 플랫폼 전체 시스템
- **Seller**: 대여 물품을 등록하고 제공하는 판매자(대여자)
- **Buyer**: 대여 물품을 검색하고 대여하는 구매자(대여받는 자)
- **Admin**: 플랫폼 전체를 관리하는 관리자
- **Guest**: 비회원 방문자
- **Item**: 대여 가능한 개별 물품
- **Category**: 콘서트, 졸업사진, 여행, 캠핑, 결혼식, 면접, 페스티벌 등 물품 분류 단위
- **Item Type**: 카테고리 내 세부 물품 분류 (예: 콘서트 > 응원봉)
- **Checklist**: 사용자가 필요한 물품을 선택하는 체크박스 UI 컴포넌트
- **AI_Chatbot**: AWS Bedrock 기반 대여 물품 추천 및 상담 AI 챗봇
- **Escrow**: 플랫폼이 보증금을 수납·보관하고 조건에 따라 환불 또는 귀속하는 정책
- **Deposit**: 대여 거래 시 구매자가 납부하는 보증금
- **Pickup_Zone**: 플랫폼이 운영하는 물품 수령·반납 거점
- **Direct_Trade**: 판매자와 구매자가 직접 만나 물품을 주고받는 거래 방식
- **Clean_Bot**: 1:1 채팅 메시지를 실시간으로 모니터링하는 AWS Bedrock 기반 AI 필터
- **JWT**: JSON Web Token, 사용자 인증 및 API 접근 제어에 사용되는 토큰
- **RBAC**: Role-Based Access Control, 역할 기반 접근 제어
- **SES**: AWS Simple Email Service, 이메일 발송 서비스
- **Scheduler**: 매일 오전 9시(KST)에 반납 기한 임박 알림을 발송하는 배치 작업
- **Notification**: 대여 예약, 확정, 반납, 기한 임박 등 사용자에게 전달되는 알림
- **Card**: 결제 및 보증금 처리를 위해 사전 등록하는 카드 정보 (PG 검증 완료 및 만료되지 않은 카드)
- **Penalty**: 연체 또는 파손 발생 시 보증금에서 차감되는 금액

---

## Requirements

### Requirement 1: 회원가입 및 이메일 인증

**User Story:** As a Guest, I want to register with my real name, email, phone number, nickname, and password, so that I can access platform features as an authenticated member.

#### Acceptance Criteria

1. THE Platform SHALL collect the following fields during registration: real name, email address, phone number, nickname, and password.
2. WHEN a Guest submits a registration form, THE Platform SHALL send a verification email to the provided email address via AWS SES within 60 seconds.
3. WHEN a Guest clicks the email verification link, THE Platform SHALL set the `is_verified` flag to `true` in the database and display a registration completion message.
4. IF a Guest attempts to log in without completing email verification, THEN THE Platform SHALL reject the login attempt and display a "이메일 인증이 필요합니다" message with a resend verification email option.
5. WHEN a Guest enters a nickname, email address, or phone number during registration, THE Platform SHALL check for duplicates in real time via a dedicated API and display an availability status within 500ms.
6. IF a duplicate nickname, email address, or phone number is detected, THEN THE Platform SHALL display an inline error message adjacent to the relevant field and prevent form submission.
7. THE Platform SHALL hash passwords using bcrypt with a minimum cost factor of 10 before storing them in the database.
8. WHEN a Guest submits the registration form, THE Platform SHALL require acceptance of the Terms of Service, Privacy Policy (including AI chat analysis consent), and Deposit Policy before completing registration.
9. IF a Guest submits the registration form with any required agreement unchecked, THEN THE Platform SHALL prevent submission and highlight the unchecked agreement checkboxes.

---

### Requirement 2: 이메일 기반 로그인 및 JWT 발급

**User Story:** As a registered User, I want to log in with my email and password, so that I can access authenticated features and maintain a session.

#### Acceptance Criteria

1. WHEN a User submits a valid email and password combination, THE Platform SHALL issue a JWT and return it in the response body to the client.
2. IF a User submits an incorrect email or password, THEN THE Platform SHALL return a generic authentication error message without revealing which field is incorrect.
3. WHEN a JWT is issued, THE Platform SHALL set an expiration time of 24 hours.
4. WHEN an API request is received with an invalid or expired JWT, THE Platform SHALL reject the request with an HTTP 401 response.
5. WHEN a WebSocket connection is initiated without a valid JWT, THE Platform SHALL reject the connection with an authentication error.
6. IF a User submits 5 consecutive failed login attempts within 10 minutes, THEN THE Platform SHALL lock the account for 15 minutes and return a lockout message indicating the remaining wait time.

---

### Requirement 3: 역할 기반 권한 제어 (RBAC)

**User Story:** As a Platform operator, I want role-based access control enforced on all endpoints, so that Guests, Users, and Admins can only perform actions permitted for their role.

#### Acceptance Criteria

1. THE Platform SHALL assign one of three roles to each account: Guest, User, or Admin.
2. WHILE a visitor has no valid JWT or has an expired JWT, THE Platform SHALL permit access to item browsing (GET /items, GET /items/:id, GET /categories) only and deny all other authenticated actions with an HTTP 401 response.
3. WHEN a User with a valid JWT accesses a protected endpoint, THE Platform SHALL verify the role claim in the JWT before processing the request.
4. IF the JWT contains a malformed or unrecognized role claim, THEN THE Platform SHALL reject the request with an HTTP 403 response.
5. IF a User role account attempts to access an Admin-only endpoint, THEN THE Platform SHALL return an HTTP 403 response.
6. IF an Admin role account attempts to access a User-only endpoint, THEN THE Platform SHALL permit access.
7. THE Platform SHALL permit Admins to: delete any listing (DELETE /admin/items/:id), view all user accounts, and manage platform-wide settings.
8. IF a request is made to a role-restricted endpoint without the required role, THEN THE Platform SHALL return an HTTP 403 response.

---

### Requirement 4: 카테고리 단일 등록 및 상품 관리 (판매자)

**User Story:** As a Seller, I want to register items under a single specific category, so that buyers can find items accurately without bundled listings.

#### Acceptance Criteria

1. WHEN a Seller registers an Item, THE Platform SHALL require selection of exactly one Category from the predefined list.
2. THE Platform SHALL support the following Categories and their Item Types (selectable options within a Category):
   - 콘서트: 울트라 핸드폰, 대포카메라, 응원봉, 손풍기, 보조배터리, 쌍안경, 돗자리, 기타
   - 졸업사진: 학사모, 졸업가운, 꽃다발, 정장, 구두, 기타
   - 여행: 돼지코, 캐리어, 디카, 보조배터리, 고프로, 여행용 와이파이(에그), 기타
   - 캠핑: 텐트, 타프, 쉘터, 침구, 계절용품, 조리도구(화로/코펠/버너), 식기, 의자, 테이블, 가구, 타포(그늘막), 수레, 기타
   - 결혼식: 하객룩, 구두, 넥타이, 기타
   - 면접: 면접룩, 구두, 기타
   - 페스티벌: 의상, 방수팩, 선글라스, 기타
3. WHEN a Seller selects a Category, THE Platform SHALL require selection of exactly one Item Type from that Category's predefined list.
4. IF a Seller selects the "기타" Item Type, THEN THE Platform SHALL require the Seller to enter a custom item name between 1 and 30 characters.
5. IF a Seller attempts to register an Item without selecting a valid Category, THEN THE Platform SHALL reject the request and display a "카테고리를 선택해 주세요" validation error.
6. IF a Seller attempts to submit a registration request with more than one Category value, THEN THE Platform SHALL reject the request and display a "하나의 카테고리만 선택할 수 있습니다" error.
7. IF a Seller does not have a registered Card, THEN THE Platform SHALL block entry to the item registration form, display a "안전한 대여 환경을 위해 결제 카드 등록이 필요합니다" popup, and redirect the Seller to the Card registration page without saving any registration data.

---

### Requirement 5: AI 챗봇 및 체크박스 연동 (하이브리드 개인화 필터링)

**User Story:** As a Buyer, I want to describe my event or purpose to an AI chatbot and have the relevant item checkboxes automatically selected, so that I can quickly find the items I need.

#### Acceptance Criteria

1. THE Platform SHALL display the AI_Chatbot and the Checklist on the same screen such that both components are simultaneously visible without scrolling on a 1280×720 viewport.
2. WHEN a Buyer sends a message to the AI_Chatbot, THE Platform SHALL forward the message to AWS Bedrock and receive an inferred list of required Item Types within 10 seconds.
3. WHEN AWS Bedrock returns an inferred Item Type list, THE Platform SHALL automatically check the corresponding Checklist checkboxes within 2 seconds of receiving the response. IF an inferred Item Type does not exist in the current Checklist, THE Platform SHALL ignore that item without error.
4. WHEN a Buyer manually checks or unchecks a Checklist checkbox, THE Platform SHALL update the selected item list within 500ms without requiring AI_Chatbot interaction.
5. IF a Buyer clicks the "이 조건으로 물품 찾기" button with no checkboxes selected, THEN THE Platform SHALL display a "최소 하나의 물품을 선택해 주세요" message and prevent navigation.
6. WHEN a Buyer clicks the "이 조건으로 물품 찾기" button with at least one checkbox selected, THE Platform SHALL navigate to the filtered results page passing the array of selected checkbox IDs as query parameters.
7. WHEN the filtered results page receives a checkbox ID array, THE Platform SHALL display only Items belonging to the selected Item Types. IF no Items match the selected Item Types, THE Platform SHALL display a "조건에 맞는 상품이 없습니다" message.
8. IF AWS Bedrock returns an error or times out, THEN THE Platform SHALL display a "AI 추천을 불러올 수 없습니다. 직접 선택해 주세요" message and preserve the current Checklist state.
9. THE Platform SHALL reject Buyer messages to the AI_Chatbot that exceed 500 characters and display a character limit error.

---

### Requirement 6: 실시간 알림 및 1:1 채팅 (WebSocket)

**User Story:** As a User, I want to receive real-time notifications for rental events and chat with the other party, so that I can coordinate rentals efficiently.

#### Acceptance Criteria

1. WHEN a Buyer submits a rental reservation request, THE Platform SHALL send a real-time notification to the Seller via WebSocket within 1 second.
2. WHEN a Seller confirms a rental reservation, THE Platform SHALL send a real-time notification to the Buyer via WebSocket within 1 second.
3. WHEN a Buyer completes a return, THE Platform SHALL send a real-time notification to the Seller via WebSocket within 1 second.
4. WHILE a Direct_Trade rental has a status between "예약 확정" and "반납 완료", THE Platform SHALL provide a 1:1 chat channel between the Seller and Buyer.
5. WHILE a Pickup_Zone rental is active, THE Platform SHALL disable the 1:1 chat channel between Seller and Buyer and hide the chat UI element.
6. THE Platform SHALL maintain stable WebSocket connections for at least 500 simultaneous connections with a connection drop rate not exceeding 1% per hour.
7. IF a WebSocket connection drops unexpectedly, THEN THE Platform SHALL attempt to reconnect automatically up to 5 times at 30-second intervals. Upon successful reconnection, THE Platform SHALL deliver any missed notifications in chronological order. IF reconnection fails after 5 attempts, THE Platform SHALL display a "연결이 끊어졌습니다. 새로고침 해주세요" message.

---

### Requirement 7: 에스크로 기반 보증금 정책

**User Story:** As a Buyer, I want my deposit held securely by the platform and refunded when I return the item on time and in good condition, so that I can trust the rental process.

#### Acceptance Criteria

1. WHEN a Buyer confirms a rental, THE Platform SHALL collect the Deposit and hold it in Escrow until the rental is resolved.
2. WHEN a Buyer returns an Item on time and the Seller confirms no damage, THE Platform SHALL refund the full Deposit to the Buyer within 24 hours.
3. WHEN a Buyer exceeds the scheduled return time, THE Platform SHALL automatically deduct 20% of the original Deposit for each full calendar day of delay.
4. IF a Buyer's delay reaches 5 full calendar days, THEN THE Platform SHALL transfer the entire remaining Deposit to the Seller and close the rental with an "연체 종료" status.
5. IF a Buyer's delay is between 1 and 4 full calendar days, THEN THE Platform SHALL calculate the refund as `Deposit × (1 - 0.20 × delay_days)` and refund the remainder to the Buyer within 24 hours of rental closure.
6. WHEN a Seller reports Item damage after return, THE Platform SHALL freeze the Deposit and initiate a platform mediation process within 1 business day.
7. WHEN the platform mediation process concludes in the Seller's favor, THE Platform SHALL transfer the disputed Deposit amount to the Seller within 24 hours.
8. WHEN the platform mediation process concludes in the Buyer's favor, THE Platform SHALL refund the frozen Deposit to the Buyer within 24 hours.
9. IF a Seller does not confirm or report damage within 48 hours of the Buyer marking a return as complete, THEN THE Platform SHALL automatically refund the full Deposit to the Buyer and close the rental.
10. IF a Seller attempts to report damage more than 24 hours after confirming a return, THEN THE Platform SHALL reject the damage report and display an "검수 기한이 초과되었습니다" error.

---

### Requirement 8: 사기 방지 수령 인증 정책

**User Story:** As a Platform operator, I want buyers to upload photos of all received items within 3 hours of delivery, so that disputes about missing components can be resolved fairly.

#### Acceptance Criteria

1. WHEN an Item delivery is marked as complete, THE Platform SHALL notify the Buyer that at least one photo per delivered component must be uploaded within 3 hours.
2. WHEN a Buyer uploads component photos within the 3-hour window, THE Platform SHALL record the upload timestamp and display a "수령 인증 완료" status visible to both Buyer and Seller.
3. IF a Buyer does not upload component photos within 3 hours of delivery completion, THEN THE Platform SHALL record that all liability for missing components is assigned to the Buyer and notify the Buyer of this liability assignment.
4. IF a Buyer attempts to upload a file that is not in JPEG or PNG format, or exceeds 10MB per image, THEN THE Platform SHALL reject the upload, display a specific error message indicating the reason, and not save any partial data.

---

### Requirement 9: 결제 카드 사전 등록제 (Anti-Fraud Policy)

**User Story:** As a Platform operator, I want all Sellers and Buyers to register a payment card before transacting, so that fraudulent activity is deterred and deposits can be processed.

#### Acceptance Criteria

1. A registered Card is defined as a card that has completed payment gateway verification and is not expired.
2. IF a Seller attempts to register an Item listing without a registered Card, THEN THE Platform SHALL block entry to the registration form and redirect the Seller to the Card registration page.
3. IF a Buyer clicks the "대여하기" button without a registered Card, THEN THE Platform SHALL block the action at the UI level (disable the button) and at the API level (return HTTP 403 with a "카드 등록이 필요합니다" error body), and redirect the Buyer to the Card registration page.
4. THE Platform SHALL allow Users to view their registered Card details from the My Page.
5. THE Platform SHALL allow Users to update their registered Card from the My Page, except when an active rental order exists.
6. THE Platform SHALL allow Users to delete their registered Card from the My Page, except when an active rental order exists.
7. IF a User attempts to delete or update a Card while an active rental order exists (status not in "완료" or "취소"), THEN THE Platform SHALL reject the request and display a "진행 중인 거래가 있어 카드를 변경할 수 없습니다" message.

---

### Requirement 10: 마이페이지 및 대여 내역 관리

**User Story:** As a logged-in User, I want to manage my profile and view my rental history by status, so that I can track all my rental activities in one place.

#### Acceptance Criteria

1. THE Platform SHALL allow Users to update their nickname, password, profile image, and payment card details from the My Page. WHEN an update is successfully saved, THE Platform SHALL display a "변경사항이 저장되었습니다" confirmation message. IF the update fails, THE Platform SHALL display a specific error message.
2. IF a User attempts to change their real name, email address, or phone number without re-authentication or Admin assistance, THEN THE Platform SHALL reject the request and display a "본인 확인 후 변경 가능합니다" message.
3. WHEN a User accesses the rental history page, THE Platform SHALL display rentals grouped into the following three status categories: "대여 중" (active rentals as Buyer), "과거 대여" (completed or cancelled rentals as Buyer), and "빌려준 물품" (all rentals as Seller).
4. WHEN a User views a Direct_Trade rental in their history, THE Platform SHALL display a "대여자 1:1 채팅하기" button. IF the associated chat room exists, clicking the button SHALL redirect to that chat room. IF the chat room no longer exists, THE Platform SHALL display a "채팅방을 찾을 수 없습니다" message.
5. WHEN a User views a Pickup_Zone rental in their history, THE Platform SHALL display a "플랫폼에 문의하기" button that redirects to the Admin or customer service channel.

---

### Requirement 11: 반납 기한 임박 자동 알림 시스템

**User Story:** As a Buyer, I want to receive an automatic reminder when my return deadline is approaching, so that I can avoid late penalties.

#### Acceptance Criteria

1. THE Scheduler SHALL execute once daily at 09:00 KST (UTC+9).
2. WHEN the Scheduler executes, THE Platform SHALL query all active rentals (status not in "취소", "완료", "반납 완료") with a return deadline between 24 and 48 hours from the current time. THE Platform SHALL send at most one reminder notification per rental per scheduler execution.
3. WHEN a rental is identified as approaching its return deadline, THE Platform SHALL send a reminder notification to the Buyer containing: rental ID, item name, and return deadline timestamp (KST). IF the primary delivery channel (SES or SMS) fails, THE Platform SHALL retry once and then mark the notification as failed in the database.
4. WHERE the environment variable `NODE_ENV` is set to `test`, THE Platform SHALL skip actual email and SMS delivery and output the notification content to the console log instead.
5. IF a notification delivery attempt fails after one retry, THE Platform SHALL record the failure with the rental ID, Buyer ID, and failure reason in the notification log.

---

### Requirement 12: 거래 유형별 동적 비즈니스 로직

**User Story:** As a User, I want the platform to apply the correct rules for my chosen trade type (Pickup Zone or Direct Trade), so that the experience matches the agreed transaction method.

#### Acceptance Criteria

1. WHEN a rental is created as a Pickup_Zone transaction, THE Platform SHALL disable the 1:1 chat feature and route all payment through the platform Escrow.
2. WHEN a rental is created as a Direct_Trade transaction, THE Platform SHALL enable the 1:1 chat feature between Seller and Buyer. Payment for Direct_Trade transactions is handled directly between Seller and Buyer outside the platform Escrow.
3. WHILE a Direct_Trade chat session is active, THE Clean_Bot SHALL submit each outgoing message to AWS Bedrock for content analysis within 2 seconds of the message being sent.
4. WHEN the Clean_Bot detects abusive language, profanity, or off-platform solicitation in a message, THE Platform SHALL log a warning event and hold the message pending sender action. THE Platform SHALL display a warning popup to the sender with two options: "그래도 전송" (send anyway) or "취소" (cancel). IF the sender selects "취소", the message SHALL be discarded.
5. IF a sender accumulates 3 or more Clean_Bot warnings within a single chat session, THEN THE Platform SHALL automatically suspend the sender's chat access for that session and notify both parties.

---

### Requirement 13: AI 클린봇 채팅 모니터링

**User Story:** As a Platform operator, I want all Direct Trade chat messages to be screened by an AI content filter, so that harmful or fraudulent communication is detected and flagged.

#### Acceptance Criteria

1. WHEN a User sends a message in a Direct_Trade chat session, THE Platform SHALL submit the message text to AWS Bedrock for content analysis before delivery.
2. WHEN AWS Bedrock classifies a message as containing abusive language, profanity, or off-platform solicitation, THE Platform SHALL record a warning log entry containing: user ID, timestamp, and message content.
3. WHEN a warning is triggered, THE Platform SHALL display a warning popup to the sender and withhold message delivery until the sender explicitly clicks a confirm button. WHEN the sender confirms, the message SHALL be discarded and not delivered.
4. IF AWS Bedrock does not return a content analysis result within 5 seconds, THEN THE Platform SHALL treat the analysis as failed, allow the message to be delivered, and log the failure with: user ID, timestamp, and error reason.

---

### Requirement 14: 성능 및 부하 요구사항

**User Story:** As a Platform operator, I want the system to meet defined performance benchmarks under normal and spike load conditions, so that users experience reliable service.

#### Acceptance Criteria

1. WHILE 50 concurrent users are active for 5 minutes, THE Platform SHALL maintain an average response time of 500ms or less across all API endpoints and an error rate (defined as HTTP 5xx responses divided by total requests) below 1%.
2. WHEN concurrent user count spikes from 10 to 200 and returns to 10, THE Platform SHALL recover to an error rate below 1% within 60 seconds and maintain a peak error rate below 5% during the spike.
3. WHEN AWS Bedrock is called for AI inference and does not return a response within 10 seconds, THE Platform SHALL return an error response to the caller that includes an error indicator and no partial data, and SHALL NOT automatically retry the request.
4. WHILE 500 simultaneous WebSocket connections are active, THE Platform SHALL maintain a connection drop rate (defined as unintended disconnections without client-initiated close) not exceeding 1% per hour.
5. WHEN the test execution environment is active, THE Platform SHALL make no outbound calls to external services (AWS Bedrock, SES, SMS API) and SHALL use mock implementations for all such integrations.

---

### Requirement 15: 법적 동의 및 약관 관리

**User Story:** As a Guest registering for the platform, I want to review and accept all required legal agreements, so that I understand my rights and obligations before using the service.

#### Acceptance Criteria

1. WHEN a Guest accesses the registration form, THE Platform SHALL display checkboxes for the following three required agreements, each with a link to the full agreement text: Terms of Service, Privacy Policy (including AI chat analysis consent), and Deposit Deduction Policy.
2. IF a Guest attempts to submit the registration form without checking all three required agreement checkboxes, THEN THE Platform SHALL prevent submission and display a visible error indicator (e.g., red border or error text) adjacent to each unchecked agreement checkbox.
3. THE Platform SHALL record the UTC timestamp and agreement version string (e.g., "v1.0") for each agreement accepted by the User at the time of registration.
4. THE Platform SHALL make the full text of each agreement accessible via a dedicated URL that does not require authentication.

# Implementation Plan: HARUMAN Rental Platform

## Overview

AWS Serverless(Lambda Node.js 20.x) + Supabase PostgreSQL + React SPA 기반의 P2P/B2C 대여 중개 플랫폼을 단계적으로 구현합니다.
인증·RBAC → 아이템 관리 → 대여·에스크로 → AI 챗봇 → WebSocket 채팅·알림 → 스케줄러 순으로 빌드하며, 각 단계에서 fast-check 프로퍼티 테스트로 핵심 불변식을 검증합니다.

---

## Tasks

- [x] 1. 프로젝트 기반 구조 및 공통 유틸리티 설정
  - `backend/` (Lambda 함수), `frontend/` (React SPA), `infra/` (IaC), `tests/` (unit/property/integration) 디렉터리 구조 생성
  - TypeScript 설정(`tsconfig.json`), ESLint, Prettier, Jest + fast-check 설치 및 설정
  - 공통 `AppError` 클래스 및 `withErrorHandling` Lambda 래퍼 구현 (`backend/src/common/errors.ts`)
  - 공통 HTTP 응답 헬퍼(`response.ts`) 및 환경변수 로더(`config.ts`) 구현
  - Supabase 클라이언트 싱글턴 모듈 구현 (`backend/src/db/client.ts`)
  - `NODE_ENV=test` 시 외부 서비스(SES, Bedrock) mock 주입 구조 설정
  - _Requirements: 14.5_

- [x] 2. 데이터베이스 스키마 마이그레이션
  - [x] 2.1 Supabase PostgreSQL 스키마 파일 작성 및 적용
    - `users`, `user_agreements`, `cards`, `categories`, `item_types`, `items` 테이블 DDL 작성
    - `rentals`, `receipt_photos`, `chat_rooms`, `chat_messages`, `notifications`, `ws_connections` 테이블 DDL 작성
    - CHECK 제약조건, UNIQUE 인덱스, FK 관계 포함
    - 초기 카테고리 및 아이템 타입 시드 데이터 SQL 작성
    - _Requirements: 4.2_

- [ ] 3. 인증 Lambda 구현 (회원가입 · 로그인 · 이메일 인증)
  - [-] 3.1 회원가입 엔드포인트 구현 (`POST /auth/register`)
    - 입력 유효성 검사(real_name, email, phone, nickname, password, 약관 동의 3개)
    - bcrypt cost=10 비밀번호 해시 저장
    - `is_verified=false` 로 DB 저장, `user_agreements` 레코드 생성(UTC 타임스탬프 + 버전)
    - AWS SES 인증 이메일 발송 (60초 이내)
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 15.3_

  - [ ]* 3.2 Property 3 테스트: 비밀번호 bcrypt 해시 저장
    - **Property 3: 비밀번호 bcrypt 해시 저장**
    - **Validates: Requirements 1.7**

  - [ ]* 3.3 Property 4 테스트: 약관 미동의 시 등록 거부
    - **Property 4: 약관 미동의 시 등록 거부**
    - **Validates: Requirements 1.8, 1.9**

  - [~] 3.4 중복 확인 엔드포인트 구현 (`GET /auth/check-duplicate`)
    - email / nickname / phone 파라미터별 DB 조회, 500ms 이내 응답
    - _Requirements: 1.5, 1.6_

  - [ ]* 3.5 Property 2 테스트: 중복 필드 감지 일관성
    - **Property 2: 중복 필드 감지 일관성**
    - **Validates: Requirements 1.5, 1.6**

  - [~] 3.6 이메일 인증 엔드포인트 구현 (`POST /auth/verify-email`, `POST /auth/resend-verification`)
    - 토큰 검증 후 `is_verified=true` 업데이트
    - _Requirements: 1.3, 1.4_

  - [~] 3.7 로그인 엔드포인트 구현 (`POST /auth/login`)
    - bcrypt 검증, `is_verified` 확인, JWT(24h) 발급
    - 5회 연속 실패 시 15분 계정 잠금 (`login_failed_count`, `locked_until`)
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [ ]* 3.8 Property 1 테스트: 미인증 사용자 로그인 거부
    - **Property 1: 미인증 사용자 로그인 거부**
    - **Validates: Requirements 1.4**

  - [ ]* 3.9 Property 5 테스트: 잘못된 자격증명에 대한 제네릭 오류
    - **Property 5: 잘못된 자격증명에 대한 제네릭 오류**
    - **Validates: Requirements 2.2**

  - [ ]* 3.10 Property 6 테스트: JWT 만료 시간 불변성
    - **Property 6: JWT 만료 시간 불변성**
    - **Validates: Requirements 2.3**

  - [ ]* 3.11 Property 8 테스트: 계정 잠금 정책
    - **Property 8: 계정 잠금 정책**
    - **Validates: Requirements 2.6**

- [ ] 4. JWT 인증 미들웨어 및 RBAC 구현
  - [ ] 4.1 JWT 검증 Lambda Authorizer 구현
    - `jsonwebtoken` 으로 서명 검증, 만료 확인 → 유효하지 않으면 HTTP 401
    - `requestContext.authorizer` 에 `userId`, `role` 주입
    - WebSocket `$connect` 핸들러에서 JWT 검증 적용
    - _Requirements: 2.4, 2.5, 3.3_

  - [ ]* 4.2 Property 7 테스트: 만료/무효 JWT에 대한 401 응답
    - **Property 7: 만료/무효 JWT에 대한 401 응답**
    - **Validates: Requirements 2.4**

  - [~] 4.3 RBAC 미들웨어 구현
    - role 클레임 검증: 잘못된 형식 → HTTP 403, 권한 부족 → HTTP 403
    - Guest 허용 엔드포인트(GET /items, GET /items/:id, GET /categories) 화이트리스트 처리
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ]* 4.4 Property 9 테스트: 역할 기반 접근 제어 (RBAC)
    - **Property 9: 역할 기반 접근 제어 (RBAC)**
    - **Validates: Requirements 3.2, 3.4, 3.5**

- [~] 5. Checkpoint — 인증·RBAC 테스트 통과 확인
  - 모든 인증 및 RBAC 관련 단위·프로퍼티 테스트가 통과하는지 확인하고, 문제가 있으면 사용자에게 질문하세요.

- [ ] 6. 카드 관리 Lambda 구현
  - [~] 6.1 카드 CRUD 엔드포인트 구현 (`POST /cards`, `GET /cards`, `PUT /cards/:id`, `DELETE /cards/:id`)
    - PG 토큰 저장, 마스킹 번호, 만료일, `is_verified` 플래그 관리
    - 활성 대여 존재 시 수정·삭제 차단 (status NOT IN ('완료','취소'))
    - _Requirements: 9.1, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 6.2 카드 관련 단위 테스트 작성
    - 활성 대여 존재 시 카드 변경 차단 엣지 케이스 검증
    - _Requirements: 9.7_

- [ ] 7. 카테고리 및 아이템 Lambda 구현
  - [~] 7.1 카테고리·아이템 타입 조회 엔드포인트 구현 (`GET /categories`)
    - 카테고리 목록 및 하위 아이템 타입 반환
    - _Requirements: 4.1, 4.2_

  - [~] 7.2 아이템 등록·수정·삭제 엔드포인트 구현 (`POST /items`, `PUT /items/:id`, `DELETE /items/:id`)
    - 카테고리 단일 선택 강제, 아이템 타입 단일 선택 강제
    - "기타" 선택 시 custom_item_name(1~30자) 필수 검증
    - 카드 미등록 Seller 차단 (HTTP 403 CARD_REQUIRED)
    - S3 이미지 업로드 presigned URL 생성 연동
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 9.2_

  - [~] 7.3 아이템 목록·상세 조회 엔드포인트 구현 (`GET /items`, `GET /items/:id`)
    - 카테고리/아이템 타입 필터, 체크박스 ID 배열 쿼리 파라미터 지원
    - Guest 접근 허용
    - _Requirements: 5.6, 5.7_

  - [~] 7.4 Admin 아이템 강제 삭제 엔드포인트 구현 (`DELETE /admin/items/:id`)
    - Admin role 전용, RBAC 미들웨어 적용
    - _Requirements: 3.7_

  - [ ]* 7.5 아이템 관련 단위 테스트 작성
    - 카테고리 단일 선택, 기타 아이템 이름 유효성, 카드 미등록 차단 케이스
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 8. 마이페이지 Lambda 구현
  - [~] 8.1 프로필 조회·수정 엔드포인트 구현 (`GET /users/me`, `PUT /users/me`)
    - nickname, password, profile_image 수정 허용
    - real_name, email, phone 변경 시도 차단 (HTTP 403)
    - _Requirements: 10.1, 10.2_

  - [ ]* 8.2 프로필 수정 단위 테스트 작성
    - 불변 필드(real_name, email, phone) 변경 차단 케이스
    - _Requirements: 10.2_

- [ ] 9. 보증금 계산 모듈 및 대여 Lambda 구현
  - [~] 9.1 보증금 계산 함수 구현 (`backend/src/rental/deposit.ts`)
    - `calculateDepositRefund(depositAmount, delayDays)` 구현
    - 1~4일: 20% × delayDays 차감, 5일 이상: 전액 귀속
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]* 9.2 Property 10 테스트: 보증금 연체 계산 정확성
    - **Property 10: 보증금 연체 계산 정확성**
    - **Validates: Requirements 7.3, 7.4, 7.5**

  - [~] 9.3 대여 예약 요청 엔드포인트 구현 (`POST /rentals`)
    - Buyer 카드 등록 확인, 에스크로 보증금 수납(`deposit_held` 설정)
    - 대여 레코드 생성(status='예약요청'), 채팅방 생성(Direct_Trade 시)
    - _Requirements: 7.1, 9.3, 12.1, 12.2_

  - [~] 9.4 대여 상태 전환 엔드포인트 구현
    - `PATCH /rentals/:id/confirm` — Seller 수락, status='예약확정'
    - `PATCH /rentals/:id/return` — Buyer 반납, status='반납완료'
    - `PATCH /rentals/:id/damage` — Seller 파손 신고, status='분쟁중', 24h 초과 시 차단
    - 48h 내 Seller 미응답 자동 환불 로직 (EventBridge 또는 DB 트리거)
    - _Requirements: 7.2, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [~] 9.5 대여 내역 조회 엔드포인트 구현 (`GET /rentals`, `GET /rentals/:id`)
    - 상태별 그룹핑(대여 중 / 과거 대여 / 빌려준 물품)
    - _Requirements: 10.3, 10.4, 10.5_

  - [~] 9.6 수령 인증 사진 업로드 엔드포인트 구현 (`POST /rentals/:id/receipt-photos`)
    - JPEG/PNG, 10MB 이하 검증, S3 업로드, 3시간 타임스탬프 기록
    - 3시간 초과 시 Buyer 책임 자동 기록
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 9.7 대여·에스크로 단위 테스트 작성
    - 보증금 수납/환불/귀속 엣지 케이스, 파손 신고 24h 초과 차단
    - _Requirements: 7.1, 7.2, 7.9, 7.10_

- [~] 10. Checkpoint — 대여·에스크로 테스트 통과 확인
  - 모든 대여 및 보증금 관련 단위·프로퍼티 테스트가 통과하는지 확인하고, 문제가 있으면 사용자에게 질문하세요.

- [ ] 11. WebSocket Lambda 구현 (실시간 알림 및 1:1 채팅)
  - [~] 11.1 WebSocket 연결 관리 핸들러 구현 (`$connect`, `$disconnect`)
    - JWT 검증 후 `ws_connections` 테이블에 connection_id 저장/삭제
    - _Requirements: 2.5, 6.6_

  - [~] 11.2 실시간 알림 전송 유틸리티 구현 (`backend/src/notify/push.ts`)
    - API Gateway Management API를 통해 특정 userId의 활성 연결에 메시지 전송
    - 대여 이벤트(예약요청, 예약확정, 반납완료) 발생 시 1초 이내 알림
    - 연결 끊김 시 `ws_connections` 레코드 정리
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [~] 11.3 1:1 채팅 메시지 핸들러 구현 (`sendMessage` route)
    - Direct_Trade 채팅방 전용, Pickup_Zone 채팅 비활성화
    - `chat_messages` 테이블에 메시지 저장, 상대방에게 WebSocket 전송
    - _Requirements: 6.4, 6.5, 12.1, 12.2_

  - [ ]* 11.4 WebSocket 단위 테스트 작성
    - 연결 관리, 알림 전송, Pickup_Zone 채팅 차단 케이스
    - _Requirements: 6.4, 6.5_

- [ ] 12. Clean_Bot 채팅 필터 구현
  - [~] 12.1 Clean_Bot 메시지 분석 모듈 구현 (`backend/src/chat/cleanbot.ts`)
    - AWS Bedrock Claude 3 Haiku 호출 (2초 이내), 욕설·비속어·외부 거래 유도 감지
    - 5초 타임아웃 시 메시지 통과 허용 + 실패 로그 기록
    - _Requirements: 12.3, 13.1, 13.4_

  - [~] 12.2 경고 처리 및 채팅 차단 로직 구현
    - 경고 판정 시: `clean_bot_status='warned'`, `warning_count` 증가, 메시지 보류
    - `warning_count >= 3` 시 해당 세션 채팅 접근 차단
    - 경고 로그(user_id, timestamp, content) DB 기록
    - _Requirements: 12.4, 12.5, 13.2, 13.3_

  - [ ]* 12.3 Property 13 테스트: Clean_Bot 경고 메시지 보류
    - **Property 13: Clean_Bot 경고 메시지 보류**
    - **Validates: Requirements 12.4, 13.2**

  - [ ]* 12.4 Property 14 테스트: Clean_Bot 경고 누적 시 채팅 차단
    - **Property 14: Clean_Bot 경고 누적 시 채팅 차단**
    - **Validates: Requirements 12.5**

- [ ] 13. AI 챗봇 Lambda 구현 (`POST /ai/chat`)
  - [~] 13.1 AI 챗봇 엔드포인트 구현
    - 메시지 500자 초과 시 거부
    - AWS Bedrock Claude 3 Haiku 호출 (10초 타임아웃, 재시도 없음)
    - `suggestedItemTypes` 배열 반환, 오류 시 "AI 추천을 불러올 수 없습니다" 응답
    - _Requirements: 5.2, 5.3, 5.8, 5.9, 14.3_

  - [ ]* 13.2 AI 챗봇 단위 테스트 작성
    - 500자 초과 거부, Bedrock 타임아웃 오류 응답, 존재하지 않는 아이템 타입 무시
    - _Requirements: 5.3, 5.8, 5.9_

- [ ] 14. 반납 기한 임박 알림 스케줄러 구현
  - [~] 14.1 스케줄러 Lambda 구현 (`backend/src/scheduler/returnReminder.ts`)
    - EventBridge Scheduler 트리거 (매일 09:00 KST)
    - 반납 기한 24h~48h 이내 활성 대여 쿼리 (status NOT IN '취소','완료','반납완료')
    - 대여당 1회 알림 중복 방지 로직
    - _Requirements: 11.1, 11.2_

  - [~] 14.2 알림 메시지 생성 및 발송 구현
    - 알림 내용: rental_id, 물품명, 반납 기한(KST) 포함
    - AWS SES 이메일 발송, 1회 재시도 후 실패 시 notifications 테이블에 실패 기록
    - `NODE_ENV=test` 시 console.log mock 출력
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

  - [ ]* 14.3 Property 11 테스트: 스케줄러 알림 대상 선택 정확성
    - **Property 11: 스케줄러 알림 대상 선택 정확성**
    - **Validates: Requirements 11.2**

  - [ ]* 14.4 Property 12 테스트: 알림 메시지 필수 정보 포함
    - **Property 12: 알림 메시지 필수 정보 포함**
    - **Validates: Requirements 11.3**

- [~] 15. Checkpoint — 스케줄러·알림 테스트 통과 확인
  - 모든 스케줄러 및 알림 관련 단위·프로퍼티 테스트가 통과하는지 확인하고, 문제가 있으면 사용자에게 질문하세요.

- [ ] 16. React SPA 프론트엔드 구현
  - [~] 16.1 프로젝트 구조 및 라우팅 설정
    - React Router 설정, 인증 상태 관리(Context/Zustand), JWT 저장(httpOnly cookie 또는 메모리)
    - 공통 API 클라이언트(`axios` 인터셉터, JWT 자동 첨부, 401 처리)
    - _Requirements: 2.1, 2.4_

  - [~] 16.2 회원가입·로그인 페이지 구현
    - 실시간 중복 확인(500ms debounce), 약관 동의 체크박스 3개, 인라인 오류 표시
    - 로그인 실패 메시지, 계정 잠금 안내
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.8, 1.9, 2.2, 2.6, 15.1, 15.2_

  - [~] 16.3 AI 챗봇 + 체크박스 연동 페이지 구현
    - 1280×720 뷰포트에서 챗봇·체크리스트 동시 표시
    - Bedrock 응답 수신 후 2초 이내 체크박스 자동 선택
    - "이 조건으로 물품 찾기" 버튼, 미선택 시 오류 메시지
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9_

  - [~] 16.4 아이템 목록·상세·등록 페이지 구현
    - 필터링된 아이템 목록, 카테고리 단일 선택 폼, 카드 미등록 시 리다이렉트
    - S3 presigned URL 이미지 업로드 UI
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.2_

  - [~] 16.5 대여 예약·상태 관리 페이지 구현
    - 대여 신청, Seller 수락/거절, Buyer 반납 처리, 파손 신고 UI
    - 수령 인증 사진 업로드(JPEG/PNG, 10MB 이하, 3시간 타이머)
    - _Requirements: 7.1, 7.2, 7.6, 8.1, 8.2, 8.3, 8.4, 9.3_

  - [~] 16.6 WebSocket 클라이언트 및 실시간 알림 UI 구현
    - WebSocket 연결 관리, 30초 간격 최대 5회 재연결, 누락 알림 순서 복원
    - 알림 토스트/배지 UI, 연결 끊김 메시지
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

  - [~] 16.7 1:1 채팅 UI 구현 (Direct_Trade 전용)
    - 채팅방 입장, 메시지 전송, Clean_Bot 경고 팝업("그래도 전송" / "취소")
    - Pickup_Zone 채팅 UI 숨김 처리
    - _Requirements: 6.4, 6.5, 12.4, 13.3_

  - [~] 16.8 마이페이지 구현
    - 프로필 수정, 카드 관리, 대여 내역(상태별 탭), Direct_Trade 채팅 버튼
    - _Requirements: 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 17. 직거래 채팅방 UX · 송금 프로세스 · 신고 기능 구현
  - [ ] 17.1 DB 스키마 확장 (`infra/database/005_chat_payment_report.sql`)
    - `products` 테이블에 `bank_name VARCHAR(50)`, `account_number VARCHAR(50)` 컬럼 추가
    - `chat_rooms` 테이블에 `buyer_confirmed BOOLEAN DEFAULT FALSE`, `seller_confirmed BOOLEAN DEFAULT FALSE` 컬럼 추가
    - `reports` 테이블 생성: `id`, `message_id`, `reporter_id`, `reported_user_id`, `reason`, `created_at`
    - `notifications` 테이블 생성 (없으면): `id`, `user_id`, `type`, `content`, `status`, `created_at`

  - [ ] 17.2 백엔드: 채팅방 생성/조회 API (`POST /chat/rooms`, `GET /chat/rooms`)
    - 구매자가 [판매자에게 문의하기] 클릭 시 채팅방 생성 또는 기존 방 반환
    - `GET /chat/rooms`: 로그인 유저가 참여 중인 모든 채팅방 + 마지막 메시지 최신순 반환

  - [ ] 17.3 백엔드: 채팅 메시지 CRUD (`GET /chat/rooms/:roomId/messages`, `POST /chat/rooms/:roomId/messages`)
    - 메시지 전송 시 AWS Bedrock Nova Lite 비속어 필터링 (BANNED/PASSED만 판정)
    - modelId: `arn:aws:bedrock:ap-northeast-2::inference-profile/amazon.nova-lite-v1:0`, maxTokens=5, temperature=0.0
    - BANNED 판정 시 메시지 전송 차단 + "부적절한 표현이 포함되어 전송할 수 없습니다." 응답
    - 5초 타임아웃 시 메시지 통과 허용 + 실패 로그 기록

  - [ ] 17.4 백엔드: 메시지 신고 API (`POST /chat/report`)
    - 요청: `{ messageId, reason? }`
    - `reports` 테이블에 `message_id`, `reporter_id`, `reported_user_id` 즉시 INSERT
    - `chat_messages.warning_count` +1 업데이트
    - 응답: "신고가 완료되었습니다."

  - [ ] 17.5 백엔드: 송금 확인 API (`POST /chat/rooms/:roomId/confirm-payment`)
    - 구매자 → [송금 완료] 클릭 시 `buyer_confirmed = true` 업데이트
    - 판매자 → [입금 확인 완료] 클릭 시 `seller_confirmed = true` 업데이트
    - 양쪽 모두 true → `chat_rooms.status = 'completed'` 자동 전환
    - 응답에 `bothConfirmed` 플래그 포함

  - [ ] 17.6 백엔드: 알림 API (`GET /notifications`, `PATCH /notifications/:id/read`)
    - 로그인 유저의 알림 목록 최신순 50건 반환
    - 개별 알림 읽음 처리 (`status = 'read'`)

  - [ ] 17.7 프론트엔드: 상품 등록 페이지 — 은행명/계좌번호 입력 필드 추가
    - 판매자가 상품 등록 시 `bank_name`, `account_number` 텍스트 입력
    - `POST /items` 요청에 해당 필드 포함하여 전송
    - `owner_id`에 로그인 유저 ID 자동 세팅

  - [ ] 17.8 프론트엔드: 상품 상세 페이지 — 버튼 문구 동적 변환
    - 로그인 유저 ID === `product.owner_id` → 버튼 텍스트 "구매자와 대화하기"
    - 그 외 → "판매자에게 문의하기"
    - 클릭 시 채팅방 생성/이동

  - [ ] 17.9 프론트엔드: 채팅방 UI 전면 리뉴얼 (`Chat.tsx`)
    - **진입 시**: 계좌 정보 비노출 상태, 메시지 목록 + 입력창만 표시
    - **[구매하기] 버튼**: 구매자에게만 채팅방 상단에 노출
    - **구매하기 클릭 후**: 판매자 계좌 정보(은행명 + 계좌번호) 패널 오픈 + [송금 완료] 버튼 활성화
    - **판매자 측**: [입금 확인 완료] 버튼 노출
    - **양쪽 확인 완료**: "거래 완료" 배지 표시, 버튼 비활성화
    - **메시지 신고**: 각 말풍선 hover 시 [⚠ 신고] 아이콘 노출, 클릭 시 `POST /chat/report` 호출 + 토스트 "신고가 완료되었습니다."
    - **비속어 차단 UX**: 전송 시도 후 BANNED 응답 수신 시 경고 스낵바 표시

  - [ ] 17.10 프론트엔드: 마이페이지 — 알림함 + 채팅 내역 리스트
    - **알림함**: `GET /notifications` 연동, 읽지 않은 알림 카운트 빨간 점 배지
    - **채팅 내역**: `GET /chat/rooms` 연동, 마지막 메시지 + 시간 표시, 클릭 시 채팅방 이동

  - [ ] 17.11 AI 클린봇 역할 축소 최적화 (`backend/src/chat/cleanbot.ts`)
    - 시스템 프롬프트: "비속어·욕설이 포함되면 BANNED, 아니면 PASSED 한 단어만 출력."
    - 장외거래 유도 감지 제거 (시스템 버튼으로 대체)
    - maxTokens=5, temperature=0.0, 응답 trim 후 BANNED/PASSED만 판별

- [ ] 18. 통합 테스트 및 최종 연결
  - [~] 18.1 통합 테스트 작성 (mock 사용)
    - SES 이메일 발송 통합 테스트 (`tests/integration/ses.integration.test.ts`)
    - Bedrock AI 챗봇 통합 테스트 (`tests/integration/bedrock.integration.test.ts`)
    - WebSocket 연결·메시지 통합 테스트 (`tests/integration/websocket.integration.test.ts`)
    - 채팅 송금 확인 플로우 통합 테스트 (`tests/integration/chat-payment.integration.test.ts`)
    - _Requirements: 14.5_

  - [ ]* 18.2 스모크 테스트 작성
    - 스케줄러 실행 스모크 테스트 (`tests/smoke/scheduler.smoke.test.ts`)
    - _Requirements: 11.1_

- [~] 19. 최종 Checkpoint — 전체 테스트 통과 확인
  - 모든 단위·프로퍼티·통합 테스트가 통과하는지 확인하고, 문제가 있으면 사용자에게 질문하세요.

---

## Notes

- `*` 표시 서브태스크는 선택적(optional)이며 MVP 빠른 구현 시 건너뛸 수 있습니다.
- 각 태스크는 요구사항 추적성을 위해 특정 Requirements 항목을 참조합니다.
- 프로퍼티 테스트는 `fast-check` 라이브러리를 사용하며 최소 100회 반복 실행합니다.
- `NODE_ENV=test` 환경에서는 모든 외부 서비스(SES, Bedrock, SMS)를 mock으로 대체합니다.
- 체크포인트는 단계별 점진적 검증을 보장합니다.
- 보증금 계산 로직(`calculateDepositRefund`)은 프로퍼티 테스트로 수학적 불변식을 검증합니다.
- **⚠️ 중요: 상품 데이터는 `items` 테이블이 아닌 `products` 테이블에 저장되어 있음.** 상품 관련 CRUD(등록/조회/수정/삭제)는 반드시 `products` 테이블을 대상으로 해야 함. 컬럼: `id`, `title`, `description`, `category`(문자열), `subcategory`(문자열), `price`(숫자), `deposit`, `trade_type`, `image_url`, `owner_id`, `created_at`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["3.1", "4.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "4.3"] },
    { "id": 3, "tasks": ["3.5", "3.6", "4.2", "4.4"] },
    { "id": 4, "tasks": ["3.7", "6.1"] },
    { "id": 5, "tasks": ["3.8", "3.9", "3.10", "3.11", "6.2"] },
    { "id": 6, "tasks": ["7.1", "8.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4", "8.2"] },
    { "id": 8, "tasks": ["7.5", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "9.5", "9.6"] },
    { "id": 11, "tasks": ["9.7", "11.1"] },
    { "id": 12, "tasks": ["11.2", "11.3", "12.1"] },
    { "id": 13, "tasks": ["11.4", "12.2", "13.1"] },
    { "id": 14, "tasks": ["12.3", "12.4", "13.2", "14.1"] },
    { "id": 15, "tasks": ["14.2"] },
    { "id": 16, "tasks": ["14.3", "14.4"] },
    { "id": 17, "tasks": ["16.1"] },
    { "id": 18, "tasks": ["16.2", "16.3"] },
    { "id": 19, "tasks": ["16.4", "16.5", "16.6"] },
    { "id": 20, "tasks": ["16.7", "16.8"] },
    { "id": 21, "tasks": ["17.1"] },
    { "id": 22, "tasks": ["17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 23, "tasks": ["17.7", "17.8", "17.11"] },
    { "id": 24, "tasks": ["17.9", "17.10"] },
    { "id": 25, "tasks": ["18.1", "18.2"] }
  ]
}
```

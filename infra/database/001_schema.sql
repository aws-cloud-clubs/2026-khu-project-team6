-- =============================================================================
-- HARUMAN Rental Platform - Database Schema
-- File: 001_schema.sql
-- Description: 전체 테이블 DDL (CHECK 제약조건, UNIQUE 인덱스, FK 관계 포함)
-- Requirements: 4.2
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users 테이블
-- 플랫폼 사용자 정보 (Guest, User, Admin)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    real_name           VARCHAR(50)     NOT NULL,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    phone               VARCHAR(20)     NOT NULL UNIQUE,
    nickname            VARCHAR(30)     NOT NULL UNIQUE,
    password_hash       VARCHAR(255)    NOT NULL,           -- bcrypt cost=10
    is_verified         BOOLEAN         NOT NULL DEFAULT FALSE,
    role                VARCHAR(10)     NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin')),
    login_failed_count  INTEGER         NOT NULL DEFAULT 0,
    locked_until        TIMESTAMP WITH TIME ZONE,           -- NULL이면 잠금 없음
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users                     IS '플랫폼 사용자 계정';
COMMENT ON COLUMN users.password_hash       IS 'bcrypt cost=10 해시값';
COMMENT ON COLUMN users.is_verified         IS '이메일 인증 완료 여부';
COMMENT ON COLUMN users.login_failed_count  IS '연속 로그인 실패 횟수 (5회 초과 시 잠금)';
COMMENT ON COLUMN users.locked_until        IS '계정 잠금 해제 시각 (NULL이면 잠금 없음)';

-- -----------------------------------------------------------------------------
-- user_agreements 테이블
-- 사용자 약관 동의 이력 (서비스 이용약관, 개인정보처리방침, 보증금 차감 정책)
-- -----------------------------------------------------------------------------
CREATE TABLE user_agreements (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agreement_type      VARCHAR(50)     NOT NULL
                            CHECK (agreement_type IN (
                                'terms_of_service',
                                'privacy_policy',
                                'deposit_policy'
                            )),
    agreement_version   VARCHAR(10)     NOT NULL DEFAULT 'v1.0',
    agreed_at_utc       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  user_agreements                   IS '사용자 약관 동의 이력';
COMMENT ON COLUMN user_agreements.agreement_type    IS 'terms_of_service | privacy_policy | deposit_policy';
COMMENT ON COLUMN user_agreements.agreement_version IS '약관 버전 (예: v1.0)';
COMMENT ON COLUMN user_agreements.agreed_at_utc     IS '동의 시각 (UTC)';

-- -----------------------------------------------------------------------------
-- cards 테이블
-- 결제 카드 사전 등록 (PG 검증 완료 카드)
-- -----------------------------------------------------------------------------
CREATE TABLE cards (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pg_token        VARCHAR(255)    NOT NULL,               -- PG사 발급 토큰
    masked_number   VARCHAR(20)     NOT NULL,               -- 마스킹된 카드 번호 (예: **** **** **** 1234)
    card_brand      VARCHAR(30),                            -- 카드사 (예: Visa, Mastercard)
    expires_at      DATE            NOT NULL,               -- 카드 만료일
    is_verified     BOOLEAN         NOT NULL DEFAULT FALSE, -- PG 검증 완료 여부
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  cards             IS '결제 카드 사전 등록 정보';
COMMENT ON COLUMN cards.pg_token    IS 'PG사 발급 결제 토큰';
COMMENT ON COLUMN cards.is_verified IS 'PG 검증 완료 여부 (true인 카드만 유효)';

-- -----------------------------------------------------------------------------
-- categories 테이블
-- 물품 카테고리 (콘서트, 졸업사진, 여행, 캠핑, 결혼식, 면접, 페스티벌)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50)     NOT NULL UNIQUE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE categories      IS '물품 카테고리 (7개 고정 카테고리)';
COMMENT ON COLUMN categories.name IS '카테고리명 (UNIQUE)';

-- -----------------------------------------------------------------------------
-- item_types 테이블
-- 카테고리 내 세부 물품 분류 (예: 콘서트 > 응원봉)
-- -----------------------------------------------------------------------------
CREATE TABLE item_types (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID            NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        VARCHAR(50)     NOT NULL,
    is_custom   BOOLEAN         NOT NULL DEFAULT FALSE,     -- "기타" 타입 여부
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, name)                              -- 카테고리 내 이름 중복 불가
);

COMMENT ON TABLE  item_types            IS '카테고리별 세부 물품 타입';
COMMENT ON COLUMN item_types.is_custom  IS '"기타" 타입 여부 (true이면 custom_item_name 필수)';

-- -----------------------------------------------------------------------------
-- items 테이블
-- 판매자가 등록한 대여 물품
-- -----------------------------------------------------------------------------
CREATE TABLE items (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id           UUID            NOT NULL REFERENCES users(id),
    category_id         UUID            NOT NULL REFERENCES categories(id),
    item_type_id        UUID            NOT NULL REFERENCES item_types(id),
    custom_item_name    VARCHAR(30),                        -- "기타" 선택 시 필수 (1~30자)
    title               VARCHAR(100)    NOT NULL,
    description         TEXT,
    price_per_day       INTEGER         NOT NULL CHECK (price_per_day >= 0),
    deposit_amount      INTEGER         NOT NULL CHECK (deposit_amount >= 0),
    trade_type          VARCHAR(20)     NOT NULL
                            CHECK (trade_type IN ('pickup_zone', 'direct_trade')),
    status              VARCHAR(20)     NOT NULL DEFAULT 'available'
                            CHECK (status IN ('available', 'rented', 'deleted')),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  items                     IS '판매자 등록 대여 물품';
COMMENT ON COLUMN items.custom_item_name    IS '"기타" 아이템 타입 선택 시 입력하는 커스텀 이름 (1~30자)';
COMMENT ON COLUMN items.price_per_day       IS '일일 대여료 (원, 0 이상)';
COMMENT ON COLUMN items.deposit_amount      IS '보증금 (원, 0 이상)';
COMMENT ON COLUMN items.trade_type          IS 'pickup_zone | direct_trade';
COMMENT ON COLUMN items.status              IS 'available | rented | deleted';

-- -----------------------------------------------------------------------------
-- rentals 테이블
-- 대여 거래 레코드 (에스크로 보증금 포함)
-- -----------------------------------------------------------------------------
CREATE TABLE rentals (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id             UUID            NOT NULL REFERENCES items(id),
    buyer_id            UUID            NOT NULL REFERENCES users(id),
    seller_id           UUID            NOT NULL REFERENCES users(id),
    trade_type          VARCHAR(20)     NOT NULL
                            CHECK (trade_type IN ('pickup_zone', 'direct_trade')),
    status              VARCHAR(30)     NOT NULL DEFAULT '예약요청'
                            CHECK (status IN (
                                '예약요청',
                                '예약확정',
                                '대여중',
                                '반납완료',
                                '검수중',
                                '분쟁중',
                                '완료',
                                '취소',
                                '연체중',
                                '연체종료'
                            )),
    deposit_amount      INTEGER         NOT NULL CHECK (deposit_amount >= 0),
    deposit_held        INTEGER         NOT NULL DEFAULT 0 CHECK (deposit_held >= 0),
    rental_start        DATE            NOT NULL,
    rental_end          DATE            NOT NULL,
    actual_return_date  DATE,                               -- 실제 반납일 (반납 전 NULL)
    delay_days          INTEGER         NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  rentals                   IS '대여 거래 레코드';
COMMENT ON COLUMN rentals.deposit_amount    IS '원래 보증금 (원)';
COMMENT ON COLUMN rentals.deposit_held      IS '에스크로 보유 보증금 (원)';
COMMENT ON COLUMN rentals.rental_start      IS '대여 시작일';
COMMENT ON COLUMN rentals.rental_end        IS '반납 예정일';
COMMENT ON COLUMN rentals.actual_return_date IS '실제 반납일 (반납 전 NULL)';
COMMENT ON COLUMN rentals.delay_days        IS '연체 일수 (1~4: 차감 환불, 5+: 전액 귀속)';

-- -----------------------------------------------------------------------------
-- receipt_photos 테이블
-- 수령 인증 사진 (S3 저장, 3시간 이내 업로드 필수)
-- -----------------------------------------------------------------------------
CREATE TABLE receipt_photos (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id   UUID            NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    s3_key      VARCHAR(500)    NOT NULL,                   -- S3 오브젝트 키
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  receipt_photos        IS '수령 인증 사진 (JPEG/PNG, 10MB 이하)';
COMMENT ON COLUMN receipt_photos.s3_key IS 'AWS S3 오브젝트 키';

-- -----------------------------------------------------------------------------
-- chat_rooms 테이블
-- 1:1 채팅방 (Direct_Trade 전용)
-- -----------------------------------------------------------------------------
CREATE TABLE chat_rooms (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id   UUID            NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
    seller_id   UUID            NOT NULL REFERENCES users(id),
    buyer_id    UUID            NOT NULL REFERENCES users(id),
    status      VARCHAR(20)     NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'closed')),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  chat_rooms        IS '1:1 채팅방 (Direct_Trade 전용)';
COMMENT ON COLUMN chat_rooms.status IS 'active | closed';

-- -----------------------------------------------------------------------------
-- chat_messages 테이블
-- 채팅 메시지 (Clean_Bot 필터링 상태 포함)
-- -----------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id             UUID            NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id           UUID            NOT NULL REFERENCES users(id),
    content             TEXT            NOT NULL,
    clean_bot_status    VARCHAR(20)     NOT NULL DEFAULT 'pending'
                            CHECK (clean_bot_status IN ('pending', 'clean', 'warned', 'failed')),
    warning_count       INTEGER         NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
    sent_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  chat_messages                     IS '채팅 메시지';
COMMENT ON COLUMN chat_messages.clean_bot_status    IS 'pending | clean | warned | failed';
COMMENT ON COLUMN chat_messages.warning_count       IS 'Clean_Bot 경고 누적 횟수 (3회 이상 시 채팅 차단)';

-- -----------------------------------------------------------------------------
-- notifications 테이블
-- 사용자 알림 (WebSocket, 이메일, SMS)
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rental_id   UUID            REFERENCES rentals(id) ON DELETE SET NULL,
    type        VARCHAR(50)     NOT NULL,                   -- 알림 유형 (예: rental_request, return_reminder)
    channel     VARCHAR(20)     NOT NULL
                    CHECK (channel IN ('websocket', 'email', 'sms')),
    status      VARCHAR(20)     NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
    content     TEXT            NOT NULL,
    sent_at     TIMESTAMP WITH TIME ZONE,                   -- 실제 발송 시각 (발송 전 NULL)
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  notifications         IS '사용자 알림 (WebSocket/이메일/SMS)';
COMMENT ON COLUMN notifications.type    IS '알림 유형 (rental_request, rental_confirmed, return_reminder 등)';
COMMENT ON COLUMN notifications.channel IS 'websocket | email | sms';
COMMENT ON COLUMN notifications.status  IS 'pending | sent | failed';
COMMENT ON COLUMN notifications.sent_at IS '실제 발송 시각 (발송 전 NULL)';

-- -----------------------------------------------------------------------------
-- ws_connections 테이블
-- WebSocket 활성 연결 관리
-- -----------------------------------------------------------------------------
CREATE TABLE ws_connections (
    connection_id   VARCHAR(255)    PRIMARY KEY,            -- API Gateway 연결 ID
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connected_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_ping_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ws_connections                IS 'WebSocket 활성 연결 관리';
COMMENT ON COLUMN ws_connections.connection_id  IS 'AWS API Gateway WebSocket 연결 ID';
COMMENT ON COLUMN ws_connections.last_ping_at   IS '마지막 핑 수신 시각 (연결 상태 확인용)';

-- =============================================================================
-- HARUMAN Rental Platform - Performance Indexes
-- File: 002_indexes.sql
-- Description: 쿼리 성능 최적화를 위한 인덱스 정의
--              001_schema.sql 적용 후 실행하세요.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users 인덱스
-- 로그인(email), 중복 확인(email, nickname, phone) 쿼리 최적화
-- -----------------------------------------------------------------------------
-- email은 UNIQUE 제약으로 이미 인덱스가 생성되지만 명시적으로 추가
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_nickname
    ON users (nickname);

CREATE INDEX IF NOT EXISTS idx_users_phone
    ON users (phone);

-- 계정 잠금 상태 조회 최적화 (locked_until IS NOT NULL 필터)
CREATE INDEX IF NOT EXISTS idx_users_locked_until
    ON users (locked_until)
    WHERE locked_until IS NOT NULL;

-- -----------------------------------------------------------------------------
-- user_agreements 인덱스
-- 사용자별 약관 동의 이력 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_agreements_user_id
    ON user_agreements (user_id);

-- -----------------------------------------------------------------------------
-- cards 인덱스
-- 사용자별 카드 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cards_user_id
    ON cards (user_id);

-- -----------------------------------------------------------------------------
-- item_types 인덱스
-- 카테고리별 아이템 타입 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_item_types_category_id
    ON item_types (category_id);

-- -----------------------------------------------------------------------------
-- items 인덱스
-- 아이템 목록 조회 (필터링: 카테고리, 아이템 타입, 상태) 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_seller_id
    ON items (seller_id);

CREATE INDEX IF NOT EXISTS idx_items_category_id
    ON items (category_id);

CREATE INDEX IF NOT EXISTS idx_items_item_type_id
    ON items (item_type_id);

CREATE INDEX IF NOT EXISTS idx_items_status
    ON items (status);

-- 카테고리 + 상태 복합 인덱스 (필터링 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_items_category_status
    ON items (category_id, status);

-- 아이템 타입 + 상태 복합 인덱스 (체크박스 필터링 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_items_item_type_status
    ON items (item_type_id, status);

-- -----------------------------------------------------------------------------
-- rentals 인덱스
-- 대여 내역 조회, 스케줄러 쿼리, 상태 전환 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rentals_buyer_id
    ON rentals (buyer_id);

CREATE INDEX IF NOT EXISTS idx_rentals_seller_id
    ON rentals (seller_id);

CREATE INDEX IF NOT EXISTS idx_rentals_item_id
    ON rentals (item_id);

CREATE INDEX IF NOT EXISTS idx_rentals_status
    ON rentals (status);

-- 반납 기한 임박 알림 스케줄러 쿼리 최적화
-- (rental_end 기준으로 24h~48h 범위 조회)
CREATE INDEX IF NOT EXISTS idx_rentals_rental_end
    ON rentals (rental_end);

-- 스케줄러: 활성 대여 + 반납 기한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_rentals_status_rental_end
    ON rentals (status, rental_end)
    WHERE status NOT IN ('취소', '완료', '반납완료');

-- -----------------------------------------------------------------------------
-- receipt_photos 인덱스
-- 대여별 수령 인증 사진 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_receipt_photos_rental_id
    ON receipt_photos (rental_id);

-- -----------------------------------------------------------------------------
-- chat_rooms 인덱스
-- 대여별, 사용자별 채팅방 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_rooms_rental_id
    ON chat_rooms (rental_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_seller_id
    ON chat_rooms (seller_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer_id
    ON chat_rooms (buyer_id);

-- -----------------------------------------------------------------------------
-- chat_messages 인덱스
-- 채팅방별 메시지 조회, 발신자별 경고 집계 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id
    ON chat_messages (room_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
    ON chat_messages (sender_id);

-- Clean_Bot 경고 집계 최적화 (room_id + sender_id + clean_bot_status)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_sender_status
    ON chat_messages (room_id, sender_id, clean_bot_status);

-- -----------------------------------------------------------------------------
-- notifications 인덱스
-- 사용자별 알림 조회, 미발송 알림 처리 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_rental_id
    ON notifications (rental_id)
    WHERE rental_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_status
    ON notifications (status);

-- 미발송 알림 처리 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
    ON notifications (user_id, status);

-- -----------------------------------------------------------------------------
-- ws_connections 인덱스
-- 사용자별 활성 WebSocket 연결 조회 최적화
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ws_connections_user_id
    ON ws_connections (user_id);

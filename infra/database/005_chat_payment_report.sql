-- 005: 채팅 송금 확인 + 상품 계좌 정보 + 신고 기능 지원
-- 실행 대상: Supabase SQL Editor

-- 1. products 테이블에 은행명/계좌번호 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- 2. chat_rooms 테이블에 양방향 송금 확인 컬럼 추가
ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seller_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. notifications 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  rental_id UUID,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  channel VARCHAR(20) DEFAULT 'push',
  status VARCHAR(20) NOT NULL DEFAULT 'unread',
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. notifications 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

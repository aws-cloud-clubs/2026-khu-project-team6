-- 009: chat_rooms 테이블에 item_id 컬럼 추가
-- 판매자가 여러 상품을 올렸을 때 상품별로 채팅방이 분리되도록 함
-- 실행 대상: Supabase SQL Editor

ALTER TABLE chat_rooms
  ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id);

-- 인덱스 (상품별 채팅방 조회 + 중복 방지)
CREATE INDEX IF NOT EXISTS idx_chat_rooms_item_id ON chat_rooms(item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_seller_buyer_item
  ON chat_rooms(seller_id, buyer_id, item_id)
  WHERE item_id IS NOT NULL;

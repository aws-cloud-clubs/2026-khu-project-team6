-- 006: chat_rooms.rental_id FK 제약 제거 + nullable 허용
-- 채팅방은 대화 시작 시 생성되고, 구매하기 클릭 시 rental이 생성되어 연결됨
-- Supabase SQL Editor에서 실행하세요.

-- 1. 기존 FK 제약 삭제 (rentals 테이블 참조)
ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_rental_id_fkey;

-- 2. NOT NULL 제약 제거 (nullable 허용)
ALTER TABLE chat_rooms ALTER COLUMN rental_id DROP NOT NULL;

-- 3. items 테이블에 bank_name, account_number 컬럼 추가 (없으면)
ALTER TABLE items ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50);
ALTER TABLE items ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

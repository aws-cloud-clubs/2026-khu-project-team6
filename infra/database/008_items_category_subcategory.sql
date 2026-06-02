-- 008: items 테이블에 category, subcategory 텍스트 컬럼 추가
-- 기존 category_id/item_type_id FK 대신 직접 텍스트로 저장 (프론트 체크리스트와 1:1 매칭)
-- 실행 대상: Supabase SQL Editor

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);

-- 인덱스 (체크리스트 필터용)
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_subcategory ON items(subcategory);
CREATE INDEX IF NOT EXISTS idx_items_category_subcategory ON items(category, subcategory);

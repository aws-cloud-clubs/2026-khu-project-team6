-- 010: notifications 테이블의 CHECK 제약조건 제거
-- channel과 status 값을 자유롭게 사용하기 위함
-- 실행 대상: Supabase SQL Editor

-- channel CHECK 제거
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;

-- status CHECK 제거
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;

-- channel 기본값을 'websocket'으로 변경
ALTER TABLE notifications ALTER COLUMN channel SET DEFAULT 'websocket';

-- status 기본값을 'sent'로 변경 (unread 의미)
ALTER TABLE notifications ALTER COLUMN status SET DEFAULT 'sent';

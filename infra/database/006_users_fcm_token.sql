-- 006: users 테이블에 FCM 토큰 컬럼 추가 (인앱 푸시 알림 확장 대비)
-- 실행 대상: Supabase SQL Editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 인덱스 (토큰으로 빠르게 조회)
CREATE INDEX IF NOT EXISTS idx_users_fcm_token
  ON users(fcm_token)
  WHERE fcm_token IS NOT NULL;

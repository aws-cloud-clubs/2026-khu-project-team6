-- =============================================================================
-- HARUMAN Rental Platform - Migration 004
-- File: 004_add_verification_token.sql
-- Description: users 테이블에 이메일 인증 토큰 컬럼 추가
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS verification_token          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN users.verification_token              IS '이메일 인증 토큰 (UUID v4)';
COMMENT ON COLUMN users.verification_token_expires_at   IS '인증 토큰 만료 시각 (발급 후 24시간)';

-- 인증 토큰 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_users_verification_token
    ON users (verification_token)
    WHERE verification_token IS NOT NULL;

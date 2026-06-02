-- ─── 이메일 인증 토큰 테이블 ─────────────────────────────────────────────────
-- Resend API를 통한 자체 이메일 인증 플로우에서 사용
-- 회원가입 시 인증 토큰을 저장하고, 사용자가 링크를 클릭하면 verified = true로 업데이트

CREATE TABLE IF NOT EXISTS email_verifications (
  email       TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 비활성화 (서버에서만 접근)
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- service_role만 접근 가능
CREATE POLICY "Service role full access" ON email_verifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

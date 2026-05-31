/**
 * HARUMAN Backend - Express 진입점
 * Supabase Auth 기반 회원가입/로그인 + 기본 라우팅
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// ─── 환경변수 검증 ───────────────────────────────────────────────────────────
const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, PORT, FRONTEND_URL } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_KEY가 .env에 설정되지 않았습니다.');
  process.exit(1);
}

// ─── Supabase 클라이언트 초기화 ──────────────────────────────────────────────
// anon key 클라이언트 (프론트엔드와 동일 권한 — Auth 호출용)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// service role 클라이언트 (서버 전용 — RLS 우회, 관리자 작업용)
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ─── Express 앱 설정 ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL || '*', credentials: true }));

// ─── 헬스체크 ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'HARUMAN Backend',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      me: 'GET /auth/me',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 중복 확인 (닉네임/이메일/전화번호) ──────────────────────────────────────
app.get('/auth/check-duplicate', async (req, res) => {
  const { field, value } = req.query;

  if (!field || !value) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'field와 value 파라미터가 필요합니다.' },
    });
  }

  const allowedFields = ['email', 'nickname', 'phone'];
  if (!allowedFields.includes(field)) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 필드입니다.' },
    });
  }

  // service role로 users 테이블에서 중복 조회
  const client = supabaseAdmin || supabase;
  const { data, error } = await client
    .from('users')
    .select('id')
    .eq(field, value)
    .limit(1);

  if (error) {
    console.error('중복 확인 오류:', error.message);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: '중복 확인에 실패했습니다.' },
    });
  }

  const available = !data || data.length === 0;
  res.json({ available, field });
});

// ─── 회원가입 (Supabase Auth signUp) ─────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { email, password, real_name, nickname, phone } = req.body;

  // 입력 유효성 검사
  if (!email || !password || !real_name || !nickname || !phone) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: '모든 필드를 입력해주세요.' },
    });
  }

  // Supabase Auth로 회원가입 (자동으로 인증 메일 발송됨)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { real_name, nickname, phone }, // user_metadata에 저장
    },
  });

  if (error) {
    // 이미 존재하는 이메일 등
    return res.status(400).json({
      error: { code: 'AUTH_ERROR', message: error.message },
    });
  }

  // 커스텀 users 테이블에 프로필 저장 (service role 사용)
  if (supabaseAdmin && data.user) {
    const { error: profileError } = await supabaseAdmin.from('users').insert({
      id: data.user.id,
      real_name,
      email,
      phone,
      nickname,
      password_hash: 'MANAGED_BY_SUPABASE_AUTH', // Supabase Auth가 비밀번호를 관리하므로 플레이스홀더
      is_verified: false,
      role: 'user',
    });

    if (profileError) {
      console.error('프로필 저장 실패:', profileError.message);
      // Auth 계정은 생성됐으므로 에러를 삼키고 진행
    }
  }

  res.status(201).json({
    message: '회원가입 완료. 이메일 인증 링크를 확인해주세요.',
    user: { id: data.user?.id, email: data.user?.email },
  });
});

// ─── 로그인 (Supabase Auth signInWithPassword) ───────────────────────────────
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: '이메일과 비밀번호를 입력해주세요.' },
    });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
    });
  }

  // 이메일 인증 여부 확인
  if (!data.user.email_confirmed_at) {
    return res.status(403).json({
      error: { code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 완료해주세요.' },
    });
  }

  // 커스텀 users 테이블에서 프로필 조회
  let profile = null;
  if (supabaseAdmin) {
    const { data: profileData } = await supabaseAdmin
      .from('users')
      .select('id, nickname, role, is_verified')
      .eq('id', data.user.id)
      .single();
    profile = profileData;
  }

  res.json({
    token: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      role: profile?.role || 'user',
      is_verified: !!data.user.email_confirmed_at,
    },
  });
});

// ─── 내 프로필 조회 (JWT 검증) ───────────────────────────────────────────────
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' },
    });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다.' },
    });
  }

  res.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      nickname: data.user.user_metadata?.nickname || '',
      is_verified: !!data.user.email_confirmed_at,
    },
  });
});

// ─── 서버 시작 ───────────────────────────────────────────────────────────────
const port = PORT || 4000;
app.listen(port, () => {
  console.log(`\n🚀 HARUMAN Backend 실행 중: http://localhost:${port}`);
  console.log(`   환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   헬스체크: http://localhost:${port}/health\n`);
});

/**
 * HARUMAN Backend - Express 진입점
 * Supabase Auth 기반 회원가입/로그인 + AI 챗봇 + 기본 라우팅
 * Prometheus 메트릭 수집 포함 (GET /metrics)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');
const { Resend } = require('resend');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const promClient = require('prom-client');

// ─── Prometheus 메트릭 설정 ──────────────────────────────────────────────────
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// HTTP 요청 카운터
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// HTTP 응답 시간 히스토그램
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// HTTP 에러 카운터
const httpErrorsTotal = new promClient.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors (4xx/5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Bedrock AI 추론 시간 히스토그램
const bedrockInferenceLatency = new promClient.Histogram({
  name: 'bedrock_inference_duration_seconds',
  help: 'Bedrock AI inference latency in seconds',
  labelNames: ['model', 'status'],
  buckets: [0.1, 0.5, 1, 2, 3, 5, 8, 10],
  registers: [register],
});

// Bedrock 타임아웃 카운터
const bedrockTimeoutsTotal = new promClient.Counter({
  name: 'bedrock_timeouts_total',
  help: 'Total number of Bedrock inference timeouts',
  registers: [register],
});

// 활성 WebSocket 연결 게이지
const wsActiveConnections = new promClient.Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// --- 환경변수 검증 ---
const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, PORT, FRONTEND_URL, RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL 또는 SUPABASE_KEY가 .env에 설정되지 않았습니다.');
  process.exit(1);
}

// Resend 클라이언트 초기화
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Bedrock 클라이언트 (AWS SDK 기본 자격증명 체인 사용)
const bedrock = new BedrockRuntimeClient({
  region: 'us-east-1',
});

// --- Supabase 클라이언트 초기화 ---
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// --- Express 앱 설정 ---
const app = express();
app.use(express.json());
app.use(cors({ origin: FRONTEND_URL || '*', credentials: true }));

// ─── Prometheus 요청 측정 미들웨어 ───────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/metrics' || req.path === '/health') {
    return next();
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSec);

    if (res.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
  });
  next();
});

// ─── Prometheus GET /metrics 엔드포인트 ──────────────────────────────────────
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
});

// --- 헬스체크 ---
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

// --- AI 챗봇 (Nova Lite, 서울 리전, 크로스 리전 추론 프로필) ---
app.post('/ai/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(422).json({ reply: '메시지를 입력해주세요.', suggestedItemTypes: [] });
    }
    if (message.length > 500) {
      return res.status(422).json({ reply: '메시지는 500자 이하로 입력해주세요.', suggestedItemTypes: [] });
    }

    const command = new InvokeModelCommand({
      modelId: 'us.amazon.nova-lite-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: [{ text: message }] }
        ],
        system: [
          {
            text: '너는 유저의 상황에 맞는 최적의 물품을 매핑해주는 유연한 추천 전문가야.\n\n규칙:\n1. 유저 키워드가 목록과 정확히 일치하지 않아도, 맥락상 가장 어울리는 물품을 유추하여 반드시 추천해라.\n2. 절대 "추천할 수 없다", "목록에 없다", "죄송합니다" 같은 거절/설명 문구를 출력하지 마라.\n3. 인사말, 서론, 부연설명 없이 오직 아래 JSON만 즉시 출력해라.\n\n출력 형식(이것만 출력):\n{"reply":"한줄 추천 메시지","suggestedItemTypes":["물품1","물품2","물품3"]}\n\n추천 가능 물품 목록: 텐트,타프,쉘터,침구,의자,테이블,수레,캐리어,돼지코,디카,고프로,보조배터리,여행용 와이파이(에그),응원봉,대포카메라,쌍안경,손풍기,돗자리,울트라 핸드폰,학사모,졸업가운,꽃다발,정장,구두,하객룩,넥타이,면접룩,의상,방수팩,선글라스\n\n위 목록에서 상황에 맞는 것을 골라 추천해. 어떤 입력이든 반드시 1개 이상 추천해라.'
          }
        ],
        inferenceConfig: {
          maxTokens: 150,
          temperature: 0.1
        }
      })
    });

    // Bedrock 호출 + 5초 타임아웃 (Promise.race)
    const BEDROCK_TIMEOUT_MS = 5000;
    const startTime = Date.now();
    let response;

    try {
      response = await Promise.race([
        bedrock.send(command),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('BEDROCK_TIMEOUT')), BEDROCK_TIMEOUT_MS)
        ),
      ]);
      const latencySec = (Date.now() - startTime) / 1000;
      bedrockInferenceLatency.observe({ model: 'nova-lite', status: 'success' }, latencySec);
    } catch (timeoutErr) {
      const latencySec = (Date.now() - startTime) / 1000;
      if (timeoutErr.message === 'BEDROCK_TIMEOUT') {
        bedrockTimeoutsTotal.inc();
        bedrockInferenceLatency.observe({ model: 'nova-lite', status: 'timeout' }, latencySec);
        return res.json({ reply: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', suggestedItemTypes: [] });
      }
      bedrockInferenceLatency.observe({ model: 'nova-lite', status: 'error' }, latencySec);
      throw timeoutErr;
    }

    const body = JSON.parse(Buffer.from(response.body).toString());

    // Nova 응답 구조: { output: { message: { content: [{ text: "..." }] } } }
    const text = body?.output?.message?.content?.[0]?.text || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.json({ reply: text || '추천 결과를 파싱할 수 없습니다.', suggestedItemTypes: [] });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return res.json({ reply: text, suggestedItemTypes: [] });
    }

    res.json({
      reply: parsed.reply || '추천 결과입니다.',
      suggestedItemTypes: Array.isArray(parsed.suggestedItemTypes) ? parsed.suggestedItemTypes : []
    });

  } catch (err) {
    res.json({ reply: 'AI 추천을 불러올 수 없습니다.', suggestedItemTypes: [] });
  }
});

// --- 이메일 인증 요청 (Resend 기반 — users.verification_token 사용) ---
app.post('/auth/send-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
    }

    if (!resend) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Resend API 키가 설정되지 않았습니다.' } });
    }

    const client = supabaseAdmin || supabase;
    const verificationToken = crypto.randomUUID();

    // ─── 안전한 upsert 로직 ───────────────────────────────────────────
    const { data: existingUser } = await client
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      const { error: updateErr } = await client
        .from('users')
        .update({ verification_token: verificationToken, is_verified: false })
        .eq('id', existingUser.id);

      if (updateErr) {
        return res.status(500).json({ error: { code: 'DB_ERROR', message: 'DB 업데이트 실패' } });
      }
    } else {
      const newUserId = crypto.randomUUID();
      const { error: insertErr } = await client
        .from('users')
        .insert({
          id: newUserId,
          email,
          nickname: '',
          real_name: '',
          phone: '',
          verification_token: verificationToken,
          is_verified: false,
        });

      if (insertErr) {
        return res.status(500).json({ error: { code: 'DB_ERROR', message: 'DB 저장 실패: ' + insertErr.message } });
      }
    }

    // ─── Resend 메일 발송 ─────────────────────────────────────────────
    const confirmUrl = `${FRONTEND_URL || 'https://haruman.shop'}/api/auth/confirm?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    const emailPayload = {
      from: RESEND_FROM_EMAIL || 'no-reply@haruman.shop',
      to: email,
      subject: '[HARUMAN] 이메일 인증을 완료해주세요',
      html: `<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;"><h1 style="font-size:24px;font-weight:bold;margin-bottom:16px;">HARUMAN</h1><p style="font-size:14px;color:#555;margin-bottom:24px;">아래 버튼을 클릭하여 이메일 인증을 완료해주세요.</p><a href="${confirmUrl}" style="display:inline-block;background-color:#7c3aed;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;">이메일 인증하기</a><p style="font-size:12px;color:#999;margin-top:24px;">이 링크는 30분 동안 유효합니다.</p></div>`,
    };

    await resend.emails.send(emailPayload);

    res.json({ message: '인증 메일이 발송되었습니다. 메일함에서 링크를 클릭해주세요.' });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'MAIL_ERROR', message: '인증 메일 발송 실패' },
    });
  }
});

// --- 이메일 인증 확인 (Confirm — users.verification_token 검증) ---
app.get('/auth/confirm', async (req, res) => {
  const { token, email } = req.query;

  if (!token || !email) {
    return res.status(400).send('<html><body><h1>잘못된 인증 링크입니다.</h1></body></html>');
  }

  const client = supabaseAdmin || supabase;

  const { data: user, error: selectErr } = await client
    .from('users')
    .select('id, verification_token, is_verified')
    .eq('email', email)
    .single();

  if (selectErr || !user) {
    return res.status(400).send('<html><body><h1>유효하지 않은 인증 링크입니다.</h1><p>해당 이메일로 가입 요청을 찾을 수 없습니다.</p></body></html>');
  }

  if (user.verification_token !== token) {
    return res.status(400).send('<html><body><h1>유효하지 않은 인증 링크입니다.</h1><p>만료되었거나 이미 사용된 링크입니다. 인증 메일을 재발송해주세요.</p></body></html>');
  }

  const { error: updateErr } = await client
    .from('users')
    .update({ is_verified: true, verification_token: null })
    .eq('id', user.id);

  if (updateErr) {
    return res.status(500).send('<html><body><h1>인증 처리 중 오류가 발생했습니다.</h1><p>다시 시도해주세요.</p></body></html>');
  }

  const frontendUrl = FRONTEND_URL || 'http://localhost:5173';
  const redirectUrl = `${frontendUrl}/signup?verified=true&email=${encodeURIComponent(email)}`;

  res.redirect(302, redirectUrl);
});

// --- 이메일 인증 상태 확인 (프론트엔드 폴링용 — users.is_verified 참조) ---
app.post('/auth/verify-email-status', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
  }

  const client = supabaseAdmin || supabase;
  const { data, error } = await client
    .from('users')
    .select('is_verified')
    .eq('email', email)
    .single();

  if (error || !data) {
    return res.json({ verified: false });
  }

  res.json({ verified: !!data.is_verified });
});

// --- 인증 메일 재발송 (users.verification_token 갱신) ---
app.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
  }

  if (!resend) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Resend API 키가 설정되지 않았습니다.' } });
  }

  // 새 토큰 생성 및 users 테이블 업데이트
  const verificationToken = crypto.randomUUID();
  const client = supabaseAdmin || supabase;

  await client
    .from('users')
    .update({ verification_token: verificationToken, is_verified: false })
    .eq('email', email);

  const confirmUrl = `${FRONTEND_URL || 'https://haruman.shop'}/api/auth/confirm?token=${verificationToken}&email=${encodeURIComponent(email)}`;

  try {
    await resend.emails.send({
      from: RESEND_FROM_EMAIL || 'no-reply@haruman.shop',
      to: email,
      subject: '[HARUMAN] 이메일 인증을 완료해주세요',
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">HARUMAN</h1>
          <p style="font-size: 14px; color: #555; margin-bottom: 24px;">
            아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
          </p>
          <a href="${confirmUrl}" 
             style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            이메일 인증하기
          </a>
          <p style="font-size: 12px; color: #999; margin-top: 24px;">
            이 링크는 30분 동안 유효합니다.
          </p>
        </div>
      `,
    });
    res.json({ message: '인증 메일이 발송되었습니다. 메일함을 확인해주세요.' });
  } catch (sendError) {
    return res.status(500).json({ error: { code: 'MAIL_ERROR', message: '메일 발송에 실패했습니다.' } });
  }
});

// --- 중복 확인 ---
app.get('/auth/check-duplicate', async (req, res) => {
  const { field, value } = req.query;
  if (!field || !value) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'field와 value 파라미터가 필요합니다.' } });
  }

  const allowedFields = ['email', 'nickname', 'phone'];
  if (!allowedFields.includes(field)) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 필드입니다.' } });
  }

  const client = supabaseAdmin || supabase;
  const { data, error } = await client.from('users').select('id').eq(field, value).limit(1);
  if (error) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '중복 확인에 실패했습니다.' } });
  }

  const available = !data || data.length === 0;
  res.json({ available, field });
});

// --- 회원가입 (이메일 인증 완료 후 — users 테이블 is_verified 확인) ---
app.post('/auth/register', async (req, res) => {
  const { email, password, real_name, nickname, phone } = req.body;
  if (!email || !password || !real_name || !nickname || !phone) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '모든 필드를 입력해주세요.' } });
  }

  const client = supabaseAdmin || supabase;

  // 1. users 테이블에서 이메일 인증 완료 여부 확인
  const { data: existingUser } = await client
    .from('users')
    .select('id, is_verified, nickname')
    .eq('email', email)
    .single();

  if (!existingUser || !existingUser.is_verified) {
    return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 먼저 완료해주세요.' } });
  }

  // 이미 가입 완료된 유저인지 확인 (nickname이 이미 설정됨)
  if (existingUser.nickname && existingUser.nickname.length > 0) {
    return res.status(409).json({ error: { code: 'DUPLICATE_EMAIL', message: '이미 가입된 이메일입니다.' } });
  }

  // 2. Supabase Auth에 유저 생성 (비밀번호는 Supabase Auth가 관리)

  // 3. users 테이블 UPDATE (send-verification에서 이미 임시 레코드 생성됨)
  const { error: updateError } = await client.from('users').update({
    real_name,
    nickname,
    phone,
    verification_token: null, // 토큰 클리어
  }).eq('id', existingUser.id);

  if (updateError) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '회원가입에 실패했습니다.' } });
  }

  // 4. Supabase Auth에도 유저 생성 (로그인 세션 관리용)
  if (supabaseAdmin) {
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { real_name, nickname, phone },
    }).catch(() => { /* Supabase Auth 유저 생성 실패 — 무시 */ });
  }

  res.status(201).json({ message: '회원가입이 완료되었습니다. 로그인해주세요.', user: { id: existingUser.id, email } });
});

// --- 로그인 ---
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일과 비밀번호를 입력해주세요.' } });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
      return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 완료해주세요.' } });
    }
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' } });
  }

  let profile = null;
  if (supabaseAdmin) {
    const { data: profileData } = await supabaseAdmin.from('users').select('id, nickname, is_verified').eq('id', data.user.id).single();
    profile = profileData;
  }

  res.json({
    token: data.session.access_token,
    user: {
      id: data.user.id, email: data.user.email,
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      is_verified: !!data.user.email_confirmed_at,
    },
  });
});

// --- 내 프로필 조회 ---
app.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다.' } });
  }

  const client = supabaseAdmin || supabase;
  const { data: profile } = await client.from('users').select('id, real_name, email, phone, nickname, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profile?.real_name || data.user.user_metadata?.real_name || '',
      email: data.user.email,
      phone: profile?.phone || data.user.user_metadata?.phone || '',
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      is_verified: !!data.user.email_confirmed_at,
      created_at: profile?.created_at || data.user.created_at,
    },
  });
});

// --- /users/me 프로필 조회 ---
app.get('/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다.' } });
  }

  const client = supabaseAdmin || supabase;
  const { data: profile } = await client.from('users').select('id, real_name, email, phone, nickname, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profile?.real_name || data.user.user_metadata?.real_name || '',
      email: data.user.email,
      phone: profile?.phone || data.user.user_metadata?.phone || '',
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      is_verified: !!data.user.email_confirmed_at,
      created_at: profile?.created_at || data.user.created_at,
    },
  });
});

// --- FCM 토큰 업데이트 (인앱 푸시 알림용 — users.fcm_token 저장) ---
app.put('/users/fcm-token', authMiddleware, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token || typeof fcm_token !== 'string') {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'fcm_token이 필요합니다.' } });
    }

    const client = supabaseAdmin || supabase;
    const { error } = await client
      .from('users')
      .update({ fcm_token })
      .eq('id', req.user.id);

    if (error) {
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'FCM 토큰 저장에 실패했습니다.' } });
    }

    res.json({ message: 'FCM 토큰이 업데이트되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- /users/me 프로필 수정 ---
app.put('/users/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다.' } });
  }

  const { nickname, password } = req.body;
  const client = supabaseAdmin || supabase;

  if (nickname) {
    await client.from('users').update({ nickname }).eq('id', data.user.id);
    if (supabaseAdmin) {
      await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        user_metadata: { ...data.user.user_metadata, nickname },
      });
    }
  }

  if (password && supabaseAdmin) {
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, { password });
    if (pwError) {
      return res.status(400).json({ error: { code: 'AUTH_ERROR', message: '비밀번호 변경에 실패했습니다.' } });
    }
  }

  const { data: profileData } = await client.from('users').select('id, real_name, email, phone, nickname, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profileData?.real_name || '',
      email: data.user.email,
      phone: profileData?.phone || '',
      nickname: profileData?.nickname || nickname || '',
      is_verified: !!data.user.email_confirmed_at,
      created_at: profileData?.created_at || data.user.created_at,
    },
  });
});

// --- JWT 인증 미들웨어 (users 테이블 자동 동기화) ---
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
    }
    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다. 다시 로그인해주세요.' } });
    }
    req.user = data.user;

    // users 테이블에 해당 유저가 없으면 자동 동기화 (FK 위반 방지)
    const client = supabaseAdmin || supabase;
    const { data: existingById } = await client
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingById) {
      const { data: existingByEmail } = await client
        .from('users')
        .select('id')
        .eq('email', data.user.email)
        .maybeSingle();

      if (existingByEmail) {
        await client
          .from('users')
          .update({ id: data.user.id })
          .eq('id', existingByEmail.id);
      } else {
        await client.from('users').insert({
          id: data.user.id,
          email: data.user.email || '',
          real_name: data.user.user_metadata?.real_name || '',
          nickname: data.user.user_metadata?.nickname || data.user.email?.split('@')[0] || '',
          phone: data.user.user_metadata?.phone || '',
          is_verified: true,
        });
      }
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 처리 중 오류가 발생했습니다.' } });
  }
}

// --- 카드 목록 조회 ---
app.get('/cards', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { data: cards, error } = await client
      .from('cards')
      .select('id, masked_number, card_brand, expires_at, is_verified, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: { message: '카드 조회 실패' } });
    }
    res.json({ cards: cards || [] });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 카드 등록 ---
app.post('/cards', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const client = supabaseAdmin || supabase;
    const { billing_key, card_number, card_brand, expires_month, expires_year } = req.body;

    let pgToken = billing_key;
    let maskedNumber = '';

    if (billing_key) {
      const last4 = card_number ? card_number.replace(/\D/g, '').slice(-4) : '0000';
      maskedNumber = `**** **** **** ${last4}`;
    } else if (card_number) {
      const cleanNumber = card_number.replace(/\D/g, '');
      if (cleanNumber.length < 13 || cleanNumber.length > 19) {
        return res.status(422).json({ error: { message: '유효한 카드 번호를 입력해주세요.' } });
      }
      maskedNumber = '**** **** **** ' + cleanNumber.slice(-4);
      pgToken = `billingkey_test_${Date.now()}_${cleanNumber.slice(-4)}`;
    } else {
      return res.status(422).json({ error: { message: 'billing_key 또는 card_number가 필요합니다.' } });
    }

    const expiresAt = `${expires_year || 2030}-${String(expires_month || 12).padStart(2, '0')}-01`;

    const { data: card, error } = await client
      .from('cards')
      .insert({ user_id: userId, pg_token: pgToken, masked_number: maskedNumber, card_brand: card_brand || null, expires_at: expiresAt, is_verified: true })
      .select('id, masked_number, card_brand, expires_at, is_verified, created_at')
      .single();

    if (error) {
      return res.status(400).json({ error: { message: '카드 등록 실패: ' + error.message } });
    }
    res.status(201).json({ card });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 카드 삭제 ---
app.delete('/cards/:id', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { data: card } = await client.from('cards').select('id, user_id').eq('id', req.params.id).single();
    if (!card) return res.status(404).json({ error: { message: '카드를 찾을 수 없습니다.' } });
    if (card.user_id !== req.user.id) return res.status(403).json({ error: { message: '본인의 카드만 삭제할 수 있습니다.' } });
    await client.from('cards').delete().eq('id', req.params.id);
    res.json({ message: '카드가 삭제되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 상품 등록 → items 테이블 (최종 스키마: seller_id, title, description, price_per_day, deposit_amount, trade_type, status, image_url, bank_name, account_number) ---
app.post('/items', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { title, description, price, deposit, trade_type, image_url, bank_name, account_number, category, subcategory } = req.body;

    const { data, error } = await client
      .from('items')
      .insert({
        seller_id: req.user.id,
        title,
        description: description || null,
        price_per_day: Number(price) || 0,
        deposit_amount: Number(deposit) || 0,
        trade_type: trade_type || '직거래',
        image_url: image_url || null,
        bank_name: bank_name || null,
        account_number: account_number || null,
        category: category || null,
        subcategory: subcategory || null,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: { message: '상품 등록 실패: ' + error.message } });
    }
    res.status(201).json({ item: data });
  } catch (err) {
    res.status(500).json({ error: { message: '상품 등록 실패' } });
  }
});

// --- 상품 조회 → items 테이블 ---
app.get('/items', async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { category, subcategory } = req.query;

    let query = client.from('items').select('*').order('created_at', { ascending: false });

    // category 필터 (items.category 컬럼 직접 매칭)
    if (category && typeof category === 'string') {
      query = query.eq('category', category);
    }

    // subcategory 필터 (items.subcategory 컬럼 직접 매칭)
    if (subcategory && typeof subcategory === 'string') {
      query = query.eq('subcategory', subcategory);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: { message: error.message } });
    }

    const items = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: `${item.price_per_day}원`,
      image: item.image_url,
      tradeMethod: item.trade_type,
      seller_id: item.seller_id,
      status: item.status,
      bank_name: item.bank_name,
      account_number: item.account_number,
      category: item.category || null,
      subcategory: item.subcategory || null,
    }));

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: { message: '상품 조회 실패' } });
  }
});

// --- 상품 상세 조회 → items 테이블 ---
app.get('/items/:id', async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('items')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: { message: '상품을 찾을 수 없습니다.' } });
    }
    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: { message: '상품 조회 실패' } });
  }
});

// --- 메시지 신고 (레거시 — /chat/rooms/:roomId/report 사용 권장) ---
app.post('/chat/report', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) {
      return res.status(422).json({ error: { message: 'messageId가 필요합니다.' } });
    }

    const client = supabaseAdmin || supabase;

    // chat_messages.is_reported = true 업데이트
    const { error: updateErr } = await client
      .from('chat_messages')
      .update({ is_reported: true })
      .eq('id', messageId);

    if (updateErr) {
      return res.status(500).json({ error: { message: '신고 처리 실패' } });
    }

    res.json({ message: '신고가 완료되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 채팅방 상태 조회 (프론트엔드 UI 분기용) ---
app.get('/chat/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { roomId } = req.params;
    const userId = req.user.id;

    const { data: room, error } = await client
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      return res.status(404).json({ error: { message: '채팅방을 찾을 수 없습니다.' } });
    }

    // 참여자 확인
    if (room.seller_id !== userId && room.buyer_id !== userId) {
      return res.status(403).json({ error: { message: '접근 권한이 없습니다.' } });
    }

    // status가 'RENTAL'이면 (rental_id가 NOT NULL) 계좌 정보 포함
    let accountInfo = null;
    if (room.status === 'RENTAL' && room.rental_id) {
      const { data: rental } = await client
        .from('rentals')
        .select('item_id')
        .eq('id', room.rental_id)
        .single();

      if (rental?.item_id) {
        const { data: item } = await client
          .from('items')
          .select('bank_name, account_number')
          .eq('id', rental.item_id)
          .single();
        accountInfo = item ? { bank_name: item.bank_name, account_number: item.account_number } : null;
      }
    }

    res.json({ room, accountInfo });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 채팅방 목록 조회 (마이페이지용) ---
app.get('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const client = supabaseAdmin || supabase;

    const { data: rooms, error } = await client
      .from('chat_rooms')
      .select('id, rental_id, seller_id, buyer_id, status, buyer_confirmed, seller_confirmed, created_at')
      .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: { message: '채팅방 조회 실패' } });
    }

    // 각 채팅방의 마지막 메시지 조회
    const roomsWithLastMessage = await Promise.all(
      (rooms || []).map(async (room) => {
        const { data: lastMsg } = await client
          .from('chat_messages')
          .select('content, sent_at, sender_id')
          .eq('room_id', room.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...room,
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.sent_at || room.created_at,
        };
      })
    );

    res.json({ rooms: roomsWithLastMessage });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 채팅 메시지 조회 ---
app.get('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { roomId } = req.params;

    // 채팅방 참여자 확인
    const { data: room } = await client
      .from('chat_rooms')
      .select('seller_id, buyer_id')
      .eq('id', roomId)
      .single();

    if (!room || (room.seller_id !== req.user.id && room.buyer_id !== req.user.id)) {
      return res.status(403).json({ error: { message: '접근 권한이 없습니다.' } });
    }

    const { data: messages, error } = await client
      .from('chat_messages')
      .select('id, room_id, sender_id, content, sent_at')
      .eq('room_id', roomId)
      .order('sent_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: { message: '메시지 조회 실패' } });
    }

    res.json({ messages: messages || [] });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 채팅 메시지 전송 (Bedrock 검열 비활성화 — 안정성 우선) ---
app.post('/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  const client = supabaseAdmin || supabase;
  const { roomId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || content.trim().length === 0) {
  return res.status(422).json({ error: { message: '메시지 내용이 필요합니다.' } });
}

// Clean_Bot 검사
const command = new InvokeModelCommand({
  modelId: 'us.amazon.nova-lite-v1:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: [{ text: content }]
      }
    ],
    system: [
      {
        text: `
너는 채팅 검열 봇이다.

규칙:
1. 욕설, 비속어, 심한 모욕 표현이 있으면 BANNED
2. 없으면 PASSED
3. 오직 BANNED 또는 PASSED 한 단어만 출력
`
      }
    ],
    inferenceConfig: {
      maxTokens: 5,
      temperature: 0
    }
  })
});

const aiResponse = await bedrock.send(command);
const aiBody = JSON.parse(Buffer.from(aiResponse.body).toString());

const verdict =
  aiBody?.output?.message?.content?.[0]?.text?.trim() || 'PASSED';

if (verdict.includes('BANNED')) {
  return res.status(200).json({
    event: 'clean_bot_warning',
    message: '부적절한 표현이 감지되었습니다.'
  });
}

try {
    // 채팅방 참여자 확인
    const { data: room, error: roomErr } = await client
      .from('chat_rooms')
      .select('seller_id, buyer_id')
      .eq('id', roomId)
      .single();

    if (roomErr) {
      return res.status(500).json({ error: { message: '채팅방 조회 실패' } });
    }

    if (!room) {
      return res.status(404).json({ error: { message: '채팅방을 찾을 수 없습니다.' } });
    }

    if (room.seller_id !== userId && room.buyer_id !== userId) {
      return res.status(403).json({ error: { message: '접근 권한이 없습니다.' } });
    }

    // 메시지 저장 (최소 필수 컬럼만)
    const { data: savedMsg, error: insertErr } = await client
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertErr) {
      return res.status(500).json({ error: { message: '메시지 저장 실패: ' + (insertErr.message || insertErr.code) } });
    }

    // ─── 인앱 푸시 알림: 상대방에게 notifications INSERT ───
    try {
      const recipientId = room.seller_id === userId ? room.buyer_id : room.seller_id;

      // 보낸 사람 닉네임 조회
      const { data: senderProfile } = await client
        .from('users')
        .select('nickname')
        .eq('id', userId)
        .single();

      const senderNickname = senderProfile?.nickname || '알 수 없음';

      const { error: notifErr } = await client.from('notifications').insert({
        user_id: recipientId,
        type: 'chat_message',
        channel: 'websocket',
        status: 'sent',
        content: JSON.stringify({
          title: senderNickname,
          body: content.trim().slice(0, 200),
          roomId,
          senderId: userId,
          messageId: savedMsg.id,
        }),
      });

      if (notifErr) {
        // 알림 저장 실패 — 무시
      }
    } catch {
      // 알림 발송 실패해도 메시지 전송은 정상 처리
    }

    return res.status(201).json({ message: savedMsg });
  } catch (err) {
    return res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 채팅방 생성 또는 기존 채팅방 조회 ---
app.post('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { productId, sellerId } = req.body;
    const buyerId = req.user.id;

    if (!productId || !sellerId) {
      return res.status(422).json({ error: { message: 'productId와 sellerId가 필요합니다.' } });
    }

    // 자기 자신과 채팅방 생성 방지
    if (buyerId === sellerId) {
      return res.status(422).json({ error: { message: '자신의 상품에는 채팅을 시작할 수 없습니다.' } });
    }

    // 기존 채팅방 확인 (seller + buyer + item_id 조합 — 상품별로 다른 채팅방)
    const { data: existing, error: findErr } = await client
      .from('chat_rooms')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('buyer_id', buyerId)
      .eq('item_id', productId)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      // 조회 실패 — 무시하고 새로 생성
    }

    if (existing) {
      return res.json({ room: existing });
    }

    // 새 채팅방 생성 (item_id 포함)
    const { data: newRoom, error: createErr } = await client
      .from('chat_rooms')
      .insert({
        seller_id: sellerId,
        buyer_id: buyerId,
        item_id: productId,
        status: 'CHAT',
      })
      .select()
      .single();

    if (createErr || !newRoom) {
      return res.status(500).json({ error: { message: '채팅방 생성 실패' } });
    }

    res.status(201).json({ room: newRoom });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 알림 목록 조회 ---
app.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: { message: '알림 조회 실패' } });
    }
    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 알림 읽음 처리 ---
app.patch('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    await client
      .from('notifications')
      .update({ status: 'read' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 송금 확인 (구매자/판매자 양방향) ---
app.post('/chat/rooms/:roomId/confirm-payment', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { roomId } = req.params;
    const userId = req.user.id;
    const { role } = req.body; // 'buyer' or 'seller'

    const { data: room } = await client
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room) {
      return res.status(404).json({ error: { message: '채팅방을 찾을 수 없습니다.' } });
    }

    // 권한 확인
    if (role === 'buyer' && room.buyer_id !== userId) {
      return res.status(403).json({ error: { message: '권한이 없습니다.' } });
    }
    if (role === 'seller' && room.seller_id !== userId) {
      return res.status(403).json({ error: { message: '권한이 없습니다.' } });
    }

    // 상태 업데이트 (buyer_confirmed / seller_confirmed 필드 활용)
    const updateField = role === 'buyer' ? 'buyer_confirmed' : 'seller_confirmed';
    await client
      .from('chat_rooms')
      .update({ [updateField]: true })
      .eq('id', roomId);

    // 양쪽 모두 확인했는지 체크
    const { data: updated } = await client
      .from('chat_rooms')
      .select('buyer_confirmed, seller_confirmed, rental_id')
      .eq('id', roomId)
      .single();

    const bothConfirmed = updated?.buyer_confirmed && updated?.seller_confirmed;
    let rentalStatus = 'REQUESTED';
    let rentalId = updated?.rental_id || null;

    if (bothConfirmed) {
      if (rentalId) {
        // 이미 rental이 연결되어 있으면 상태만 COMPLETED로
        await client
          .from('rentals')
          .update({ status: 'COMPLETED' })
          .eq('id', rentalId);
        rentalStatus = 'COMPLETED';
      } else {
        // rental_id가 없으면 → rentals 테이블에 새로 INSERT (직거래 거래 완료)
        try {
          // chat_rooms.item_id에서 상품 ID를 가져옴
          const itemId = room.item_id || null;

          const today = new Date();
          const rentalEnd = new Date(today);
          rentalEnd.setDate(rentalEnd.getDate() + 3);

          const { data: newRental, error: rentalErr } = await client
            .from('rentals')
            .insert({
              item_id: itemId,
              buyer_id: room.buyer_id,
              seller_id: room.seller_id,
              status: 'COMPLETED',
              rental_start: today.toISOString().split('T')[0],
              rental_end: rentalEnd.toISOString().split('T')[0],
            })
            .select()
            .single();

          if (rentalErr) {
            // rentals INSERT 실패 — 무시
          } else {
            rentalId = newRental.id;
            rentalStatus = 'COMPLETED';
            // chat_rooms에 rental_id 연결
            await client
              .from('chat_rooms')
              .update({ rental_id: newRental.id, status: 'RENTAL' })
              .eq('id', roomId);
          }
        } catch (rentalInsertErr) {
          // rentals INSERT 예외 — 무시
        }
      }
    }

    res.json({
      confirmed: true,
      bothConfirmed,
      rentalStatus,
    });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 구매하기 (채팅방에서 거래 생성 — chat_rooms.status를 'RENTAL'로 변경) ---
app.post('/chat/rooms/:roomId/purchase', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { roomId } = req.params;
    const userId = req.user.id;
    const { itemId, rentalStart, rentalEnd } = req.body;

    // 채팅방 확인
    const { data: room } = await client
      .from('chat_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room) {
      return res.status(404).json({ error: { message: '채팅방을 찾을 수 없습니다.' } });
    }

    if (room.buyer_id !== userId) {
      return res.status(403).json({ error: { message: '구매자만 구매할 수 있습니다.' } });
    }

    // 이미 rental이 연결된 경우
    if (room.rental_id) {
      return res.status(400).json({ error: { message: '이미 거래가 진행 중입니다.' } });
    }

    // rentals 생성
    const { data: rental, error: rentalErr } = await client
      .from('rentals')
      .insert({
        item_id: itemId,
        buyer_id: userId,
        seller_id: room.seller_id,
        status: 'REQUESTED',
        rental_start: rentalStart || new Date().toISOString(),
        rental_end: rentalEnd || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (rentalErr) {
      return res.status(500).json({ error: { message: '거래 생성 실패' } });
    }

    // chat_rooms.rental_id 세팅 + status를 'RENTAL'로 변경
    await client
      .from('chat_rooms')
      .update({ rental_id: rental.id, status: 'RENTAL' })
      .eq('id', roomId);

    // items 테이블에서 판매자 계좌 정보 조회
    let accountInfo = null;
    if (itemId) {
      const { data: item } = await client
        .from('items')
        .select('bank_name, account_number')
        .eq('id', itemId)
        .single();
      accountInfo = item ? { bank_name: item.bank_name, account_number: item.account_number } : null;
    }

    res.status(201).json({
      rental: { id: rental.id, status: rental.status },
      accountInfo,
    });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 메시지 신고 (chat_messages.is_reported = true) ---
app.post('/chat/rooms/:roomId/report', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) {
      return res.status(422).json({ error: { message: 'messageId가 필요합니다.' } });
    }

    const client = supabaseAdmin || supabase;

    // 해당 메시지가 이 채팅방에 속하는지 확인
    const { data: msg, error: fetchErr } = await client
      .from('chat_messages')
      .select('id, room_id, sender_id')
      .eq('id', messageId)
      .single();

    if (fetchErr || !msg) {
      return res.status(404).json({ error: { message: '메시지를 찾을 수 없습니다.' } });
    }

    if (msg.room_id !== req.params.roomId) {
      return res.status(403).json({ error: { message: '잘못된 채팅방입니다.' } });
    }

    // chat_messages.is_reported = true 업데이트
    const { error: updateErr } = await client
      .from('chat_messages')
      .update({ is_reported: true })
      .eq('id', messageId);

    if (updateErr) {
      return res.status(500).json({ error: { message: '신고 처리 실패' } });
    }

    res.json({ message: '신고가 완료되었습니다.' });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 대여 생성 (픽업존/직거래 공통) ---
app.post('/rentals', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const buyerId = req.user.id;
    const { item_id, seller_id, rental_start, rental_end } = req.body;

    if (!item_id || !rental_start || !rental_end) {
      return res.status(422).json({ error: { message: 'item_id, rental_start, rental_end가 필요합니다.' } });
    }

    // seller_id가 없으면 item에서 가져옴 + trade_type 확인
    let finalSellerId = seller_id;
    let tradeType = null;
    const { data: item } = await client.from('items').select('seller_id, trade_type').eq('id', item_id).single();
    if (item) {
      if (!finalSellerId) finalSellerId = item.seller_id;
      tradeType = item.trade_type;
    }

    if (!finalSellerId) {
      return res.status(422).json({ error: { message: '판매자 정보를 찾을 수 없습니다.' } });
    }

    // 자기 자신 대여 방지
    if (buyerId === finalSellerId) {
      return res.status(422).json({ error: { message: '본인 상품은 대여할 수 없습니다.' } });
    }

    // 픽업존: 즉시 대여 완료 (RENTING) / 직거래: 요청 상태 (REQUESTED)
    const isPickupZone = tradeType === '픽업존' || tradeType === 'pickup_zone';
    const rentalStatus = isPickupZone ? 'RENTING' : 'REQUESTED';

    const { data: rental, error } = await client
      .from('rentals')
      .insert({
        item_id,
        buyer_id: buyerId,
        seller_id: finalSellerId,
        status: rentalStatus,
        rental_start,
        rental_end,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: { message: '대여 생성 실패: ' + error.message } });
    }

    // 픽업존일 경우 items.status도 'rented'로 변경
    if (isPickupZone) {
      await client.from('items').update({ status: 'rented' }).eq('id', item_id);
    }

    res.status(201).json({ rental });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 내 대여 내역 조회 (buyer 또는 seller로 참여한 모든 rentals) ---
app.get('/rentals/me', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const userId = req.user.id;

    // buyer 또는 seller로 참여한 rentals 조회
    const { data: buyerRentals, error: buyerErr } = await client
      .from('rentals')
      .select('id, item_id, buyer_id, seller_id, status, rental_start, rental_end, created_at')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    const { data: sellerRentals, error: sellerErr } = await client
      .from('rentals')
      .select('id, item_id, buyer_id, seller_id, status, rental_start, rental_end, created_at')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false });

    if (buyerErr || sellerErr) {
      return res.status(500).json({ error: { message: '대여 내역 조회 실패' } });
    }

    // 중복 제거
    const allRentals = [...(buyerRentals || []), ...(sellerRentals || [])];
    const unique = allRentals.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);

    // 각 rental의 item 정보 가져오기
    const itemIds = [...new Set(unique.map((r) => r.item_id).filter(Boolean))];
    let itemsMap = {};
    if (itemIds.length > 0) {
      const { data: items } = await client
        .from('items')
        .select('id, title, price_per_day, image_url, trade_type')
        .in('id', itemIds);
      if (items) {
        itemsMap = Object.fromEntries(items.map((i) => [i.id, i]));
      }
    }

    // 상태 매핑 (한글 상태 + 영문 상태 모두 지원)
    const statusMap = {
      'REQUESTED': '요청 중',
      'CONFIRMED': '확정',
      'RENTING': '대여 중',
      'COMPLETED': '거래 완료',
      'CANCELLED': '취소됨',
      '예약요청': '요청 중',
      '예약확정': '확정',
      '대여중': '대여 중',
      '반납완료': '반납 완료',
      '검수중': '검수 중',
      '분쟁중': '분쟁 중',
      '완료': '거래 완료',
      '취소': '취소됨',
      '연체중': '연체 중',
      '연체종료': '연체 종료',
    };

    const rentals = unique.map((r) => {
      const item = itemsMap[r.item_id] || {};
      // trade_type은 items 테이블에서 가져옴 (rentals에는 없음)
      const tradeMethod = item.trade_type === 'pickup_zone' ? '픽업존'
        : item.trade_type === 'direct_trade' ? '직거래'
        : item.trade_type === '픽업존' ? '픽업존'
        : item.trade_type === '직거래' ? '직거래'
        : item.trade_type || '직거래';

      // 마감 기한 계산
      let daysLeft = null;
      if (r.rental_end) {
        const endDate = new Date(r.rental_end);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      }

      return {
        id: r.id,
        productName: item.title || '상품명 없음',
        image: item.image_url || '',
        price: item.price_per_day ? `${item.price_per_day}원/일` : '가격 미정',
        rentalDate: r.rental_start && r.rental_end ? `${r.rental_start} ~ ${r.rental_end}` : '기간 미정',
        rentalEnd: r.rental_end || null,
        daysLeft,
        status: statusMap[r.status] || r.status,
        tradeMethod,
        role: r.buyer_id === userId ? 'buyer' : 'seller',
      };
    });

    res.json({ rentals });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
  }
});

// --- 서버 시작 ---
const port = PORT || 4000;
app.listen(port, () => {
  console.log(`\nHARUMAN Backend running: http://localhost:${port}`);
  console.log(`  env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  health: http://localhost:${port}/health\n`);
});

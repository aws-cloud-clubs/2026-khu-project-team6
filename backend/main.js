/**
 * HARUMAN Backend - Express 진입점
 * Supabase Auth 기반 회원가입/로그인 + AI 챗봇 + 기본 라우팅
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require('@aws-sdk/client-bedrock-runtime');

// --- 환경변수 검증 ---
const { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY, PORT, FRONTEND_URL } = process.env;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL 또는 SUPABASE_KEY가 .env에 설정되지 않았습니다.');
  process.exit(1);
}

// Bedrock 클라이언트 (서울 리전 고정)
const bedrock = new BedrockRuntimeClient({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
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
app.post('/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(422).json({ reply: '메시지를 입력해주세요.', suggestedItemTypes: [] });
    }
    if (message.length > 500) {
      return res.status(422).json({ reply: '메시지는 500자 이하로 입력해주세요.', suggestedItemTypes: [] });
    }

    const command = new InvokeModelCommand({
      modelId: 'eu.amazon.nova-lite-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: [{ text: message }] }
        ],
        system: [
          {
            text: '너는 HARUMAN 대여 플랫폼 추천AI다. 반드시 아래 JSON만 출력해.\n{"reply":"한줄답변","suggestedItemTypes":["물품1","물품2"]}\n추천 가능 목록만 사용: 텐트,타프,쉘터,침구,의자,테이블,수레,캐리어,돼지코,디카,고프로,보조배터리,여행용 와이파이(에그),응원봉,대포카메라,쌍안경,손풍기,돗자리,울트라 핸드폰,학사모,졸업가운,꽃다발,정장,구두,하객룩,넥타이,면접룩,의상,방수팩,선글라스\n목록에 없는 아이템은 절대 포함하지 마. JSON 외 텍스트 출력 금지.'
          }
        ],
        inferenceConfig: {
          maxTokens: 50,
          temperature: 0.1
        }
      })
    });

    const response = await bedrock.send(command);
    const body = JSON.parse(Buffer.from(response.body).toString());

    // Nova 응답 구조: { output: { message: { content: [{ text: "..." }] } } }
    const text = body?.output?.message?.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.json({ reply: '추천 결과를 파싱할 수 없습니다.', suggestedItemTypes: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    res.json({
      reply: parsed.reply || '추천 결과입니다.',
      suggestedItemTypes: Array.isArray(parsed.suggestedItemTypes) ? parsed.suggestedItemTypes : []
    });

  } catch (err) {
    console.error('[AI Chat] Nova Lite error:', err.message);
    res.json({ reply: 'AI 추천을 불러올 수 없습니다.', suggestedItemTypes: [] });
  }
});

// --- Bedrock 연결 테스트 ---
app.get('/bedrock-test', async (req, res) => {
  try {
    const command = new InvokeModelCommand({
      modelId: 'eu.amazon.nova-lite-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [
          { role: 'user', content: [{ text: 'hello' }] }
        ],
        system: [{ text: '간단히 인사해.' }],
        inferenceConfig: { maxTokens: 50, temperature: 0.1 }
      })
    });

    const response = await bedrock.send(command);
    const body = JSON.parse(Buffer.from(response.body).toString());
    res.json({ success: true, result: body });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 이메일 인증 요청 ---
app.post('/auth/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${FRONTEND_URL || 'http://localhost:5173'}/email-verified` },
  });

  if (error) {
    console.error('인증 메일 발송 실패:', error.message);
    return res.status(400).json({ error: { code: 'AUTH_ERROR', message: '인증 메일 발송에 실패했습니다: ' + error.message } });
  }
  res.json({ message: '인증 메일이 발송되었습니다. 메일함에서 링크를 클릭해주세요.' });
});

// --- 이메일 인증 상태 확인 ---
app.post('/auth/verify-email-status', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '서버 설정 오류입니다.' } });
  }

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '인증 상태 확인에 실패했습니다.' } });
  }

  const user = users.find((u) => u.email === email);
  const verified = !!(user && user.email_confirmed_at);
  res.json({ verified });
});

// --- 인증 메일 재발송 ---
app.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '이메일을 입력해주세요.' } });
  }

  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) {
    console.error('인증 메일 발송 실패:', error.message);
    return res.status(400).json({ error: { code: 'AUTH_ERROR', message: error.message } });
  }
  res.json({ message: '인증 메일이 발송되었습니다. 메일함을 확인해주세요.' });
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

// --- 회원가입 ---
app.post('/auth/register', async (req, res) => {
  const { email, password, real_name, nickname, phone } = req.body;
  if (!email || !password || !real_name || !nickname || !phone) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: '모든 필드를 입력해주세요.' } });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '서버 설정 오류입니다.' } });
  }

  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '사용자 조회에 실패했습니다.' } });
  }

  const existingUser = users.find((u) => u.email === email);
  if (!existingUser || !existingUser.email_confirmed_at) {
    return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: '이메일 인증을 먼저 완료해주세요.' } });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
    password,
    user_metadata: { real_name, nickname, phone },
  });
  if (updateError) {
    return res.status(400).json({ error: { code: 'AUTH_ERROR', message: updateError.message } });
  }

  const { error: profileError } = await supabaseAdmin.from('users').upsert({
    id: existingUser.id, real_name, email, phone, nickname,
    password_hash: 'MANAGED_BY_SUPABASE_AUTH', is_verified: true, role: 'user',
  });
  if (profileError) console.error('프로필 저장 실패:', profileError.message);

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
    const { data: profileData } = await supabaseAdmin.from('users').select('id, nickname, role, is_verified').eq('id', data.user.id).single();
    profile = profileData;
  }

  res.json({
    token: data.session.access_token,
    user: {
      id: data.user.id, email: data.user.email,
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      role: profile?.role || 'user',
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
  const { data: profile } = await client.from('users').select('id, real_name, email, phone, nickname, role, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profile?.real_name || data.user.user_metadata?.real_name || '',
      email: data.user.email,
      phone: profile?.phone || data.user.user_metadata?.phone || '',
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      role: profile?.role || 'user',
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
  const { data: profile } = await client.from('users').select('id, real_name, email, phone, nickname, role, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profile?.real_name || data.user.user_metadata?.real_name || '',
      email: data.user.email,
      phone: profile?.phone || data.user.user_metadata?.phone || '',
      nickname: profile?.nickname || data.user.user_metadata?.nickname || '',
      role: profile?.role || 'user',
      is_verified: !!data.user.email_confirmed_at,
      created_at: profile?.created_at || data.user.created_at,
    },
  });
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

  const { data: profileData } = await client.from('users').select('id, real_name, email, phone, nickname, role, is_verified, created_at').eq('id', data.user.id).single();

  res.json({
    user: {
      id: data.user.id,
      real_name: profileData?.real_name || '',
      email: data.user.email,
      phone: profileData?.phone || '',
      nickname: profileData?.nickname || nickname || '',
      role: profileData?.role || 'user',
      is_verified: !!data.user.email_confirmed_at,
      created_at: profileData?.created_at || data.user.created_at,
    },
  });
});

// --- 상품 등록 ---
app.post('/items', async (req, res) => {
  try {
    const { title, description, category, subcategory, price, deposit, trade_type, image_url, owner_id } = req.body;

    const { data, error } = await supabase
      .from('products')
      .insert({ title, description, category, subcategory, price, deposit, trade_type, image_url, owner_id })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error });
    }
    res.status(201).json({ item: data });
  } catch (err) {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ error: { message: '상품 등록 실패' } });
  }
});

// --- 상품 조회 ---
app.get('/items', async (req, res) => {
  try {
    const { category, subcategory } = req.query;
    let query = supabase.from('products').select('*');

    if (category && category.trim() !== '') {
      query = query.eq('category', category.trim());
    }
    if (subcategory && subcategory.trim() !== '') {
      query = query.eq('subcategory', subcategory.trim());
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error });
    }

    const items = (data || []).map((item) => ({
      id: item.id,
      title: item.title,
      price: `${item.price}원`,
      image: item.image_url,
      tradeMethod: item.trade_type,
      category: item.category,
      subcategory: item.subcategory,
    }));

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: '상품 조회 실패' } });
  }
});

// --- 서버 시작 ---
const port = PORT || 4000;
app.listen(port, () => {
  console.log(`\nHARUMAN Backend running: http://localhost:${port}`);
  console.log(`  env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log(`  health: http://localhost:${port}/health\n`);
});

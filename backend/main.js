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

// Bedrock 클라이언트 (크로스 리전 추론 프로필 사용 시 us-east-1 필요)
const bedrock = new BedrockRuntimeClient({
  region: 'us-east-1',
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

    const response = await bedrock.send(command);
    const body = JSON.parse(Buffer.from(response.body).toString());

    // 디버그: Nova 응답 전체 구조 확인
    console.log('[AI Chat] Nova raw response:', JSON.stringify(body, null, 2));

    // Nova 응답 구조: { output: { message: { content: [{ text: "..." }] } } }
    const text = body?.output?.message?.content?.[0]?.text || '';
    console.log('[AI Chat] Extracted text:', text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      // JSON 파싱 실패 시 텍스트 자체를 reply로 반환
      return res.json({ reply: text || '추천 결과를 파싱할 수 없습니다.', suggestedItemTypes: [] });
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[AI Chat] JSON parse error:', parseErr.message, 'raw:', jsonMatch[0]);
      return res.json({ reply: text, suggestedItemTypes: [] });
    }

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
      modelId: 'us.amazon.nova-lite-v1:0',
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

// --- JWT 인증 미들웨어 (상세 에러 로깅) ---
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Auth] 토큰 누락:', req.method, req.path);
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 토큰이 필요합니다.' } });
    }
    const token = authHeader.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      console.warn('[Auth] 토큰 검증 실패:', error?.message || 'user null', '| path:', req.path);
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다. 다시 로그인해주세요.' } });
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error('[Auth] 미들웨어 예외:', err.message || err);
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '인증 처리 중 오류: ' + (err.message || '') } });
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

// --- 상품 등록 (은행명/계좌번호 포함) ---
app.post('/items', async (req, res) => {
  try {
    const { title, description, category, subcategory, price, deposit, trade_type, image_url, owner_id, bank_name, account_number } = req.body;

    const { data, error } = await supabase
      .from('products')
      .insert({ title, description, category, subcategory, price, deposit, trade_type, image_url, owner_id, bank_name: bank_name || null, account_number: account_number || null })
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
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });

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
      owner_id: item.owner_id,
      bank_name: item.bank_name,
      account_number: item.account_number,
    }));

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: '상품 조회 실패' } });
  }
});

// --- 상품 상세 조회 (계좌 정보 포함) ---
app.get('/items/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
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

// --- 메시지 신고 (warning_count +1) ---
app.post('/chat/report', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.body;
    if (!messageId) {
      return res.status(422).json({ error: { message: 'messageId가 필요합니다.' } });
    }

    const client = supabaseAdmin || supabase;

    // 현재 warning_count 조회
    const { data: msg, error: fetchErr } = await client
      .from('chat_messages')
      .select('id, warning_count')
      .eq('id', messageId)
      .single();

    if (fetchErr || !msg) {
      return res.status(404).json({ error: { message: '메시지를 찾을 수 없습니다.' } });
    }

    // warning_count +1 업데이트
    const { error: updateErr } = await client
      .from('chat_messages')
      .update({ warning_count: (msg.warning_count || 0) + 1 })
      .eq('id', messageId);

    if (updateErr) {
      return res.status(500).json({ error: { message: '신고 처리 실패' } });
    }

    res.json({ message: '신고가 완료되었습니다.' });
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
      .select('id, room_id, sender_id, content, clean_bot_status, warning_count, sent_at')
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

  console.log(`[Chat Send] 요청 수신: user=${userId.slice(0,8)} room=${roomId.slice(0,8)} content="${(content || '').slice(0,30)}"`);

  if (!content || content.trim().length === 0) {
    return res.status(422).json({ error: { message: '메시지 내용이 필요합니다.' } });
  }

  try {
    // 채팅방 참여자 확인
    const { data: room, error: roomErr } = await client
      .from('chat_rooms')
      .select('seller_id, buyer_id')
      .eq('id', roomId)
      .single();

    if (roomErr) {
      console.error('[Chat Send] 채팅방 조회 실패:', roomErr.message, roomErr.code);
      return res.status(500).json({ error: { message: '채팅방 조회 실패: ' + roomErr.message } });
    }

    if (!room) {
      console.error('[Chat Send] 채팅방 없음:', roomId);
      return res.status(404).json({ error: { message: '채팅방을 찾을 수 없습니다.' } });
    }

    if (room.seller_id !== userId && room.buyer_id !== userId) {
      console.warn('[Chat Send] 권한 없음:', userId, 'not in', room.seller_id, room.buyer_id);
      return res.status(403).json({ error: { message: '접근 권한이 없습니다.' } });
    }

    // 메시지 저장 (Bedrock 검열 스킵 — 안정성 우선)
    const { data: savedMsg, error: insertErr } = await client
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content: content.trim(),
        clean_bot_status: 'clean',
        warning_count: 0,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Chat Send] INSERT 실패:', JSON.stringify(insertErr));
      return res.status(500).json({ error: { message: '메시지 저장 실패: ' + (insertErr.message || insertErr.code) } });
    }

    console.log('[Chat Send] 성공:', savedMsg.id);
    return res.status(201).json({ message: savedMsg });
  } catch (err) {
    console.error('[Chat Send] 예외:', err.message || err);
    return res.status(500).json({ error: { message: '서버 오류: ' + (err.message || 'unknown') } });
  }
});

// --- 채팅방 생성 또는 기존 채팅방 조회 ---
app.post('/chat/rooms', authMiddleware, async (req, res) => {
  try {
    const client = supabaseAdmin || supabase;
    const { productId, sellerId } = req.body;
    const buyerId = req.user.id;

    console.log('[Chat Rooms] 생성 요청:', { productId, sellerId, buyerId });

    if (!productId || !sellerId) {
      return res.status(422).json({ error: { message: 'productId와 sellerId가 필요합니다.' } });
    }

    // 기존 채팅방 확인 (seller + buyer 조합으로 검색)
    const { data: existing, error: findErr } = await client
      .from('chat_rooms')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('buyer_id', buyerId)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error('[Chat Rooms] 기존 방 조회 실패:', findErr.message);
    }

    if (existing) {
      console.log('[Chat Rooms] 기존 방 반환:', existing.id);
      return res.json({ room: existing });
    }

    // 새 채팅방 생성 — rental_id를 null로 설정 (FK 충돌 방지)
    const { data: newRoom, error } = await client
      .from('chat_rooms')
      .insert({
        seller_id: sellerId,
        buyer_id: buyerId,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('[Chat Rooms] INSERT 실패:', JSON.stringify(error));
      return res.status(500).json({ error: { message: '채팅방 생성 실패: ' + error.message } });
    }

    console.log('[Chat Rooms] 새 방 생성:', newRoom.id);
    res.status(201).json({ room: newRoom });
  } catch (err) {
    console.error('[Chat Rooms] 예외:', err.message || err);
    res.status(500).json({ error: { message: '서버 오류: ' + (err.message || '') } });
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
      .select('buyer_confirmed, seller_confirmed')
      .eq('id', roomId)
      .single();

    const bothConfirmed = updated?.buyer_confirmed && updated?.seller_confirmed;
    if (bothConfirmed) {
      await client
        .from('chat_rooms')
        .update({ status: 'paid' })
        .eq('id', roomId);
    }

    res.json({
      confirmed: true,
      bothConfirmed,
      status: bothConfirmed ? 'paid' : 'pending',
    });
  } catch (err) {
    res.status(500).json({ error: { message: '서버 오류' } });
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

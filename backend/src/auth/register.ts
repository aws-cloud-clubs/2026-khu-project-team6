/**
 * 회원가입 Lambda 핸들러
 * POST /auth/register
 *
 * Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 15.3
 */

import bcrypt from 'bcrypt';
import { AppError, ErrorCodes, withErrorHandling } from '../common/errors';
import { createdResponse } from '../common/response';
import { isTestEnv } from '../common/config';
import { getSupabaseClient } from '../db/client';
import { mockSendVerificationEmail } from '../mocks/ses';
import { createVerificationToken } from './emailVerification';

/** bcrypt 비용 인수 (Requirements 1.7) */
const BCRYPT_COST = 10;

/** 약관 동의 필드 타입 */
interface Agreements {
  terms_of_service: boolean;
  privacy_policy: boolean;
  deposit_policy: boolean;
}

/** 회원가입 요청 바디 타입 */
interface RegisterRequestBody {
  real_name: string;
  email: string;
  phone: string;
  nickname: string;
  password: string;
  agreements: Agreements;
}

/**
 * 실제 SES를 통해 인증 이메일을 발송합니다.
 * 프로덕션/개발 환경에서 사용됩니다.
 */
async function sendVerificationEmailViaSES(
  email: string,
  token: string,
  verificationUrl: string,
): Promise<void> {
  const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
  const fromEmail = process.env.SES_FROM_EMAIL ?? 'noreply@haruman.com';
  const region = process.env.BEDROCK_REGION ?? 'ap-northeast-2';

  const client = new SESClient({ region });
  const verifyLink = `${verificationUrl}?token=${token}`;

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: '[HARUMAN] 이메일 인증을 완료해 주세요', Charset: 'UTF-8' },
      Body: {
        Html: {
          Data: `
            <h1>HARUMAN 이메일 인증</h1>
            <p>아래 링크를 클릭하여 이메일 인증을 완료해 주세요.</p>
            <a href="${verifyLink}">이메일 인증하기</a>
            <p>링크는 24시간 동안 유효합니다.</p>
          `,
          Charset: 'UTF-8',
        },
        Text: {
          Data: `이메일 인증 링크: ${verifyLink}`,
          Charset: 'UTF-8',
        },
      },
    },
  });

  await client.send(command);
}

/**
 * 회원가입 핸들러 (내부 구현)
 */
async function registerHandler(event: unknown): Promise<ReturnType<typeof createdResponse>> {
  const body = event as { body?: string | null };

  // 요청 바디 파싱
  let parsed: RegisterRequestBody;
  try {
    parsed = JSON.parse(body?.body ?? '{}') as RegisterRequestBody;
  } catch {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '요청 바디가 올바른 JSON 형식이 아닙니다.');
  }

  const { real_name, email, phone, nickname, password, agreements } = parsed;

  // ── 1. 필수 필드 유효성 검사 (Requirements 1.1) ──────────────────────────
  if (!real_name || typeof real_name !== 'string' || real_name.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '실명을 입력해 주세요.');
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '올바른 이메일 주소를 입력해 주세요.');
  }
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '전화번호를 입력해 주세요.');
  }
  if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '닉네임을 입력해 주세요.');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '비밀번호는 8자 이상이어야 합니다.');
  }

  // ── 2. 약관 동의 검사 (Requirements 1.8, 1.9, 15.3) ─────────────────────
  if (
    !agreements ||
    agreements.terms_of_service !== true ||
    agreements.privacy_policy !== true ||
    agreements.deposit_policy !== true
  ) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '모든 필수 약관에 동의해 주세요.');
  }

  const supabase = getSupabaseClient();

  // ── 3. 중복 확인 (Requirements 1.5, 1.6) ─────────────────────────────────
  const { data: existingUsers, error: dupError } = await supabase
    .from('users')
    .select('email, nickname, phone')
    .or(`email.eq.${email},nickname.eq.${nickname},phone.eq.${phone}`);

  if (dupError) {
    console.error('중복 확인 쿼리 오류:', dupError);
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, '서버 오류가 발생했습니다.');
  }

  if (existingUsers && existingUsers.length > 0) {
    for (const user of existingUsers) {
      if (user.email === email) {
        throw new AppError(422, ErrorCodes.DUPLICATE_FIELD, '이미 사용 중인 이메일입니다.');
      }
      if (user.nickname === nickname) {
        throw new AppError(422, ErrorCodes.DUPLICATE_FIELD, '이미 사용 중인 닉네임입니다.');
      }
      if (user.phone === phone) {
        throw new AppError(422, ErrorCodes.DUPLICATE_FIELD, '이미 사용 중인 전화번호입니다.');
      }
    }
  }

  // ── 4. 비밀번호 해시 (Requirements 1.7) ──────────────────────────────────
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // ── 5. 사용자 DB 저장 (is_verified=false) ────────────────────────────────
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({
      real_name: real_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      nickname: nickname.trim(),
      password_hash: passwordHash,
      is_verified: false,
      role: 'user',
    })
    .select('id')
    .single();

  if (insertError || !newUser) {
    console.error('사용자 저장 오류:', insertError);
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, '회원가입 처리 중 오류가 발생했습니다.');
  }

  const userId = newUser.id as string;

  // ── 6. user_agreements 레코드 생성 (Requirements 15.3) ───────────────────
  const agreementTypes = ['terms_of_service', 'privacy_policy', 'deposit_policy'] as const;
  const agreementRecords = agreementTypes.map((type) => ({
    user_id: userId,
    agreement_type: type,
    agreement_version: 'v1.0',
    agreed_at_utc: new Date().toISOString(),
  }));

  const { error: agreementError } = await supabase
    .from('user_agreements')
    .insert(agreementRecords);

  if (agreementError) {
    console.error('약관 동의 저장 오류:', agreementError);
    // 사용자 레코드 롤백 시도
    await supabase.from('users').delete().eq('id', userId);
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, '회원가입 처리 중 오류가 발생했습니다.');
  }

  // ── 7. 이메일 인증 토큰 생성 및 저장 ────────────────────────────────────
  const { token: verificationToken } = await createVerificationToken(supabase, userId);

  // ── 8. 인증 이메일 발송 (Requirements 1.2) ────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/auth/verify-email`;

  if (isTestEnv()) {
    // 테스트 환경: mock 사용
    await mockSendVerificationEmail(email, verificationToken, verificationUrl);
  } else {
    // 프로덕션/개발 환경: 실제 SES 사용
    try {
      await sendVerificationEmailViaSES(email, verificationToken, verificationUrl);
    } catch (sesError) {
      console.error('SES 이메일 발송 오류:', sesError);
      // 이메일 발송 실패 시에도 회원가입은 완료 처리 (재발송 기능 제공)
    }
  }

  // ── 9. 성공 응답 (201) ────────────────────────────────────────────────────
  return createdResponse({
    userId,
    message: '인증 이메일이 발송되었습니다.',
  });
}

/** 회원가입 Lambda 핸들러 (오류 처리 래퍼 적용) */
export const handler = withErrorHandling(registerHandler);

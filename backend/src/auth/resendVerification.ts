/**
 * 인증 이메일 재발송 Lambda 핸들러
 * POST /auth/resend-verification
 *
 * Requirements: 1.4
 */

import { AppError, ErrorCodes, withErrorHandling } from '../common/errors';
import { successResponse } from '../common/response';
import { isTestEnv } from '../common/config';
import { getSupabaseClient } from '../db/client';
import { mockSendVerificationEmail } from '../mocks/ses';
import { createVerificationToken } from './emailVerification';

/**
 * 실제 SES를 통해 인증 이메일을 재발송합니다.
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
 * 인증 이메일 재발송 핸들러 (내부 구현)
 */
async function resendVerificationHandler(event: unknown): Promise<ReturnType<typeof successResponse>> {
  const body = event as { body?: string | null };

  // 요청 바디 파싱
  let parsed: { email?: string };
  try {
    parsed = JSON.parse(body?.body ?? '{}') as { email?: string };
  } catch {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '요청 바디가 올바른 JSON 형식이 아닙니다.');
  }

  const { email } = parsed;

  // ── 1. 이메일 파라미터 검증 ───────────────────────────────────────────────
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '올바른 이메일 주소를 입력해 주세요.');
  }

  const supabase = getSupabaseClient();

  // ── 2. 이메일로 사용자 조회 ───────────────────────────────────────────────
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, is_verified')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !user) {
    // 보안상 사용자 존재 여부를 노출하지 않음
    return successResponse({
      message: '해당 이메일로 인증 메일을 발송했습니다. 이메일을 확인해 주세요.',
    });
  }

  // ── 3. 이미 인증된 경우 400 오류 ─────────────────────────────────────────
  if (user.is_verified) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, '이미 이메일 인증이 완료된 계정입니다.');
  }

  // ── 4. 새 토큰 생성 및 저장 ──────────────────────────────────────────────
  const { token: verificationToken } = await createVerificationToken(supabase, user.id as string);

  // ── 5. 인증 이메일 재발송 ─────────────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/auth/verify-email`;

  if (isTestEnv()) {
    await mockSendVerificationEmail(email, verificationToken, verificationUrl);
  } else {
    try {
      await sendVerificationEmailViaSES(email, verificationToken, verificationUrl);
    } catch (sesError) {
      console.error('SES 이메일 재발송 오류:', sesError);
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, '이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  return successResponse({
    message: '인증 이메일이 재발송되었습니다. 이메일을 확인해 주세요.',
  });
}

/** 인증 이메일 재발송 Lambda 핸들러 (오류 처리 래퍼 적용) */
export const handler = withErrorHandling(resendVerificationHandler);

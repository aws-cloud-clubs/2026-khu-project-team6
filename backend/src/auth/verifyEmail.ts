/**
 * 이메일 인증 Lambda 핸들러
 * POST /auth/verify-email
 *
 * Requirements: 1.3, 1.4
 */

import { AppError, ErrorCodes, withErrorHandling } from '../common/errors';
import { successResponse } from '../common/response';
import { getSupabaseClient } from '../db/client';
import {
  findUserByVerificationToken,
  isTokenExpired,
  markEmailVerified,
} from './emailVerification';

/**
 * 이메일 인증 핸들러 (내부 구현)
 */
async function verifyEmailHandler(event: unknown): Promise<ReturnType<typeof successResponse>> {
  const body = event as { body?: string | null };

  // 요청 바디 파싱
  let parsed: { token?: string };
  try {
    parsed = JSON.parse(body?.body ?? '{}') as { token?: string };
  } catch {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '요청 바디가 올바른 JSON 형식이 아닙니다.');
  }

  const { token } = parsed;

  // ── 1. 토큰 파라미터 검증 ─────────────────────────────────────────────────
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, '인증 토큰이 필요합니다.');
  }

  const supabase = getSupabaseClient();

  // ── 2. 토큰으로 사용자 조회 ───────────────────────────────────────────────
  const user = await findUserByVerificationToken(supabase, token.trim());

  if (!user) {
    throw new AppError(422, ErrorCodes.INVALID_TOKEN, '유효하지 않은 인증 토큰입니다.');
  }

  // ── 3. 이미 인증된 사용자 확인 ───────────────────────────────────────────
  if (user.is_verified) {
    return successResponse({ message: '이미 이메일 인증이 완료된 계정입니다.' });
  }

  // ── 4. 토큰 만료 확인 (24시간) ───────────────────────────────────────────
  if (isTokenExpired(user.verification_token_expires_at)) {
    throw new AppError(422, ErrorCodes.TOKEN_EXPIRED, '인증 토큰이 만료되었습니다. 인증 이메일을 재발송해 주세요.');
  }

  // ── 5. is_verified=true 업데이트 (Requirements 1.3) ──────────────────────
  await markEmailVerified(supabase, user.id);

  return successResponse({ message: '이메일 인증이 완료되었습니다. 로그인해 주세요.' });
}

/** 이메일 인증 Lambda 핸들러 (오류 처리 래퍼 적용) */
export const handler = withErrorHandling(verifyEmailHandler);

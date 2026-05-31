/**
 * 이메일 인증 토큰 관리 모듈
 * users 테이블의 verification_token, verification_token_expires_at 컬럼을 사용합니다.
 */

import { randomUUID } from 'crypto';
import { SupabaseClient } from '../db/client';

/** 인증 토큰 만료 시간 (24시간, 밀리초) */
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** 인증 토큰 생성 결과 */
export interface VerificationTokenResult {
  token: string;
  expiresAt: Date;
}

/**
 * 새 이메일 인증 토큰을 생성하고 DB에 저장합니다.
 *
 * @param supabase - Supabase 클라이언트
 * @param userId - 사용자 UUID
 * @returns 생성된 토큰과 만료 시각
 */
export async function createVerificationToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<VerificationTokenResult> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  const { error } = await supabase
    .from('users')
    .update({
      verification_token: token,
      verification_token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`인증 토큰 저장 실패: ${error.message}`);
  }

  return { token, expiresAt };
}

/**
 * 인증 토큰으로 사용자를 조회합니다.
 *
 * @param supabase - Supabase 클라이언트
 * @param token - 인증 토큰
 * @returns 사용자 정보 또는 null (토큰이 유효하지 않거나 만료된 경우)
 */
export async function findUserByVerificationToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ id: string; email: string; is_verified: boolean; verification_token_expires_at: string } | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, is_verified, verification_token_expires_at')
    .eq('verification_token', token)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * 인증 토큰이 만료되었는지 확인합니다.
 *
 * @param expiresAt - 만료 시각 문자열 (ISO 8601)
 * @returns 만료 여부
 */
export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * 이메일 인증을 완료합니다 (is_verified=true, 토큰 삭제).
 *
 * @param supabase - Supabase 클라이언트
 * @param userId - 사용자 UUID
 */
export async function markEmailVerified(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_verified: true,
      verification_token: null,
      verification_token_expires_at: null,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`이메일 인증 완료 처리 실패: ${error.message}`);
  }
}

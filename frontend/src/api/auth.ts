/**
 * 인증 API 함수
 * Requirements: 1.x, 2.x
 */

import apiClient from './client';

// ─── 요청/응답 타입 ───────────────────────────────────────────────────────────

export interface RegisterRequest {
  real_name: string;
  email: string;
  phone: string;
  nickname: string;
  password: string;
  agreements: {
    service: boolean;
    privacy: boolean;
    deposit: boolean;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    role: 'user' | 'admin';
    is_verified: boolean;
  };
}

export interface DuplicateCheckResponse {
  available: boolean;
  field: string;
}

// ─── API 함수 ─────────────────────────────────────────────────────────────────

/** 회원가입 */
export async function register(data: RegisterRequest): Promise<void> {
  await apiClient.post('/auth/register', data);
}

/** 로그인 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', data);
  return res.data;
}

/** 이메일 인증 */
export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post('/auth/verify-email', { token });
}

/** 인증 이메일 재발송 */
export async function resendVerification(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email });
}

/**
 * 중복 확인 (email | nickname | phone)
 * 500ms debounce는 호출 측에서 처리
 */
export async function checkDuplicate(
  field: 'email' | 'nickname' | 'phone',
  value: string,
): Promise<DuplicateCheckResponse> {
  const res = await apiClient.get<DuplicateCheckResponse>('/auth/check-duplicate', {
    params: { field, value },
  });
  return res.data;
}

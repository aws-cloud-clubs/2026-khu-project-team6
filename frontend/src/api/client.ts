/**
 * Axios 기반 API 클라이언트
 * JWT 자동 첨부, 401 처리, 공통 오류 처리를 포함합니다.
 */

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/** API 오류 응답 형식 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** API 기본 URL — Vite 환경변수 또는 기본값 */
const API_BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE_URL ?? '/api';

/**
 * 인증 토큰 관리 (메모리 저장 — XSS 방어)
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
}

/**
 * Axios 인스턴스
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** 요청 인터셉터: JWT 자동 첨부 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

/** 응답 인터셉터: 401 처리 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient;

/**
 * 공통 오류 클래스 및 Lambda 오류 처리 래퍼
 * Requirements: 14.5
 */

/** API 오류 응답 형식 */
export interface ErrorResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** 공통 HTTP 응답 헤더 */
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

/**
 * 플랫폼 전용 오류 클래스
 * HTTP 상태 코드와 오류 코드를 포함하여 일관된 오류 응답을 생성합니다.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
    // TypeScript에서 Error를 상속할 때 프로토타입 체인 복원
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** 미리 정의된 오류 코드 상수 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_FIELD: 'DUPLICATE_FIELD',
  CARD_REQUIRED: 'CARD_REQUIRED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSPECTION_DEADLINE_EXCEEDED: 'INSPECTION_DEADLINE_EXCEEDED',
  ACTIVE_RENTAL_EXISTS: 'ACTIVE_RENTAL_EXISTS',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  CHAT_BLOCKED: 'CHAT_BLOCKED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Lambda 핸들러를 오류 처리 래퍼로 감쌉니다.
 * AppError는 해당 statusCode로, 예상치 못한 오류는 500으로 처리합니다.
 *
 * @param handler - 래핑할 Lambda 핸들러 함수
 * @returns 오류 처리가 적용된 Lambda 핸들러
 */
export function withErrorHandling(
  handler: (event: unknown) => Promise<ErrorResponse>,
): (event: unknown) => Promise<ErrorResponse> {
  return async (event: unknown): Promise<ErrorResponse> => {
    try {
      return await handler(event);
    } catch (error) {
      if (error instanceof AppError) {
        return {
          statusCode: error.statusCode,
          headers: DEFAULT_HEADERS,
          body: JSON.stringify({
            error: {
              code: error.code,
              message: error.message,
            },
          }),
        };
      }

      // 예상치 못한 오류는 500으로 처리하고 상세 내용은 로그에만 기록
      console.error('Unexpected error:', error);
      return {
        statusCode: 500,
        headers: DEFAULT_HEADERS,
        body: JSON.stringify({
          error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: '서버 오류가 발생했습니다.',
          },
        }),
      };
    }
  };
}

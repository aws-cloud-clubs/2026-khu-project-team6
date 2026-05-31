/**
 * 공통 HTTP 응답 헬퍼 함수
 * 모든 Lambda 핸들러에서 일관된 응답 형식을 생성합니다.
 */

/** Lambda 응답 타입 */
export interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/** 공통 CORS 및 Content-Type 헤더 */
const DEFAULT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

/**
 * 성공 응답 생성
 * @param data - 응답 데이터 (JSON 직렬화 가능한 객체)
 * @param statusCode - HTTP 상태 코드 (기본값: 200)
 * @param extraHeaders - 추가 헤더 (선택)
 */
export function successResponse<T>(
  data: T,
  statusCode = 200,
  extraHeaders: Record<string, string> = {},
): LambdaResponse {
  return {
    statusCode,
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
    body: JSON.stringify(data),
  };
}

/**
 * 생성 성공 응답 (201 Created)
 * @param data - 생성된 리소스 데이터
 */
export function createdResponse<T>(data: T): LambdaResponse {
  return successResponse(data, 201);
}

/**
 * 내용 없음 응답 (204 No Content)
 */
export function noContentResponse(): LambdaResponse {
  return {
    statusCode: 204,
    headers: DEFAULT_HEADERS,
    body: '',
  };
}

/**
 * 오류 응답 생성
 * @param statusCode - HTTP 상태 코드
 * @param code - 오류 코드 문자열
 * @param message - 사용자 친화적 오류 메시지
 * @param details - 추가 오류 상세 정보 (선택)
 */
export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): LambdaResponse {
  const body: {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  } = {
    error: { code, message },
  };

  if (details !== undefined) {
    body.error.details = details;
  }

  return {
    statusCode,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(body),
  };
}

/**
 * 401 Unauthorized 응답
 */
export function unauthorizedResponse(message = '인증이 필요합니다.'): LambdaResponse {
  return errorResponse(401, 'UNAUTHORIZED', message);
}

/**
 * 403 Forbidden 응답
 */
export function forbiddenResponse(message = '접근 권한이 없습니다.'): LambdaResponse {
  return errorResponse(403, 'FORBIDDEN', message);
}

/**
 * 404 Not Found 응답
 */
export function notFoundResponse(message = '리소스를 찾을 수 없습니다.'): LambdaResponse {
  return errorResponse(404, 'NOT_FOUND', message);
}

/**
 * 422 Validation Error 응답
 */
export function validationErrorResponse(
  message: string,
  details?: Record<string, unknown>,
): LambdaResponse {
  return errorResponse(422, 'VALIDATION_ERROR', message, details);
}

/**
 * CORS preflight 응답 (OPTIONS 메서드)
 */
export function corsPreflightResponse(): LambdaResponse {
  return {
    statusCode: 200,
    headers: {
      ...DEFAULT_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  };
}

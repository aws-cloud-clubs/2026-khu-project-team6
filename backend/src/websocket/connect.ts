/**
 * WebSocket $connect 핸들러
 * JWT 검증 후 ws_connections 테이블에 연결 정보를 저장합니다.
 * Requirements: 2.5, 3.3
 */

import { verifyJWT } from '../auth/jwt';
import { getSupabaseClient } from '../db/client';
import { AppError, ErrorCodes } from '../common/errors';

/** API Gateway WebSocket $connect 이벤트 */
interface WebSocketConnectEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
    connectedAt?: number;
  };
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string> | null;
}

/** Lambda 응답 */
interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * Authorization 헤더 또는 쿼리 파라미터에서 JWT 토큰을 추출합니다.
 *
 * @param event - WebSocket 연결 이벤트
 * @returns 추출된 토큰 문자열 또는 null
 */
function extractToken(event: WebSocketConnectEvent): string | null {
  // 쿼리 파라미터에서 token 추출 (WebSocket은 헤더 설정이 제한적이므로 우선 확인)
  const queryParams = event.queryStringParameters ?? {};
  if (queryParams['token']) {
    return queryParams['token'];
  }

  // Authorization 헤더에서 Bearer 토큰 추출
  const headers = event.headers ?? {};
  const authHeader =
    headers['Authorization'] ?? headers['authorization'] ?? null;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  return null;
}

/**
 * WebSocket $connect 핸들러
 * JWT를 검증하고 ws_connections 테이블에 연결 정보를 저장합니다.
 * 인증 실패 시 HTTP 401을 반환합니다.
 */
export const handler = async (event: WebSocketConnectEvent): Promise<LambdaResponse> => {
  const { connectionId } = event.requestContext;

  // 토큰 추출
  const token = extractToken(event);
  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: '인증 토큰이 필요합니다.',
        },
      }),
    };
  }

  // JWT 검증
  let userId: string;
  try {
    const payload = verifyJWT(token);
    userId = payload.sub;
  } catch (error) {
    if (error instanceof AppError) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          error: {
            code: error.code,
            message: error.message,
          },
        }),
      };
    }
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: '유효하지 않은 토큰입니다.',
        },
      }),
    };
  }

  // ws_connections 테이블에 연결 정보 저장
  const supabase = getSupabaseClient();
  const { error: dbError } = await supabase.from('ws_connections').insert({
    connection_id: connectionId,
    user_id: userId,
    connected_at: new Date().toISOString(),
    last_ping_at: new Date().toISOString(),
  });

  if (dbError) {
    console.error('WebSocket 연결 저장 실패:', dbError);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: '연결 정보 저장에 실패했습니다.',
        },
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: '연결되었습니다.' }),
  };
};

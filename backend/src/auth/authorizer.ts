/**
 * Lambda Authorizer (REQUEST 타입)
 * API Gateway에서 JWT를 검증하고 IAM 정책 문서를 반환합니다.
 * Requirements: 2.4, 3.3
 */

import { verifyJWT } from './jwt';

/** API Gateway REQUEST Authorizer 이벤트 */
interface AuthorizerEvent {
  type: string;
  methodArn: string;
  headers?: Record<string, string>;
  queryStringParameters?: Record<string, string> | null;
  requestContext?: {
    connectionId?: string;
    routeKey?: string;
  };
}

/** IAM 정책 Statement */
interface PolicyStatement {
  Action: string;
  Effect: 'Allow' | 'Deny';
  Resource: string;
}

/** IAM 정책 문서 */
interface PolicyDocument {
  Version: string;
  Statement: PolicyStatement[];
}

/** Lambda Authorizer 응답 */
interface AuthorizerResponse {
  principalId: string;
  policyDocument: PolicyDocument;
  context?: Record<string, string>;
}

/**
 * IAM 정책 문서를 생성합니다.
 *
 * @param effect - 'Allow' 또는 'Deny'
 * @param resource - 접근 허용/거부할 ARN
 */
function generatePolicy(effect: 'Allow' | 'Deny', resource: string): PolicyDocument {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };
}

/**
 * Authorization 헤더 또는 쿼리 파라미터에서 Bearer 토큰을 추출합니다.
 *
 * @param event - API Gateway Authorizer 이벤트
 * @returns 추출된 토큰 문자열 또는 null
 */
function extractToken(event: AuthorizerEvent): string | null {
  // Authorization 헤더에서 Bearer 토큰 추출 (대소문자 무관)
  const headers = event.headers ?? {};
  const authHeader =
    headers['Authorization'] ?? headers['authorization'] ?? null;

  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
  }

  // 쿼리 파라미터에서 token 추출 (WebSocket $connect 등)
  const queryParams = event.queryStringParameters ?? {};
  if (queryParams['token']) {
    return queryParams['token'];
  }

  return null;
}

/**
 * Lambda Authorizer 핸들러
 * JWT를 검증하고 Allow/Deny 정책을 반환합니다.
 * 유효하지 않은 토큰의 경우 "Unauthorized" 문자열을 throw하여
 * API Gateway가 HTTP 401로 변환하도록 합니다.
 */
export const handler = async (event: AuthorizerEvent): Promise<AuthorizerResponse> => {
  const token = extractToken(event);

  if (!token) {
    // API Gateway가 401로 변환
    throw new Error('Unauthorized');
  }

  try {
    const payload = verifyJWT(token);

    return {
      principalId: payload.sub,
      policyDocument: generatePolicy('Allow', event.methodArn ?? 'arn:aws:execute-api:*:*:*'),
      context: {
        userId: payload.sub,
        role: payload.role,
        email: payload.email,
      },
    };
  } catch {
    // 만료 또는 서명 오류 → API Gateway가 401로 변환
    throw new Error('Unauthorized');
  }
};

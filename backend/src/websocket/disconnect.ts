/**
 * WebSocket $disconnect 핸들러
 * ws_connections 테이블에서 연결 정보를 삭제합니다.
 * Requirements: 6.6
 */

import { getSupabaseClient } from '../db/client';
import { ErrorCodes } from '../common/errors';

/** API Gateway WebSocket $disconnect 이벤트 */
interface WebSocketDisconnectEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
    disconnectedAt?: number;
  };
}

/** Lambda 응답 */
interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * WebSocket $disconnect 핸들러
 * ws_connections 테이블에서 해당 connection_id 레코드를 삭제합니다.
 */
export const handler = async (event: WebSocketDisconnectEvent): Promise<LambdaResponse> => {
  const { connectionId } = event.requestContext;

  const supabase = getSupabaseClient();
  const { error: dbError } = await supabase
    .from('ws_connections')
    .delete()
    .eq('connection_id', connectionId);

  if (dbError) {
    // 연결 해제 시 DB 오류는 로그만 기록하고 200 반환
    // (클라이언트는 이미 연결이 끊어진 상태이므로 오류를 전달할 수 없음)
    console.error('WebSocket 연결 삭제 실패:', dbError);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: '연결 정보 삭제에 실패했습니다.',
        },
      }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: '연결이 해제되었습니다.' }),
  };
};

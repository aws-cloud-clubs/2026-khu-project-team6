/**
 * 실시간 알림 전송 유틸리티
 * API Gateway Management API를 통해 특정 userId의 활성 WebSocket 연결에 메시지를 전송합니다.
 * Requirements: 6.1, 6.2, 6.3, 6.7
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { getSupabaseClient } from '../db/client';
import { getConfig, isTestEnv } from '../common/config';

/** 알림 타입 */
export type NotificationType =
  | 'rental_requested'    // 예약요청
  | 'rental_confirmed'    // 예약확정
  | 'rental_returned'     // 반납완료
  | 'rental_damaged'      // 파손신고
  | 'return_reminder'     // 반납 기한 임박
  | 'chat_message'        // 채팅 메시지
  | 'deposit_refunded';   // 보증금 환불

/** WebSocket으로 전송할 알림 페이로드 */
export interface NotificationPayload {
  type: NotificationType;
  rentalId?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

/**
 * 특정 사용자의 모든 활성 WebSocket 연결에 알림을 전송합니다.
 * 연결이 끊어진 경우(GoneException) ws_connections 레코드를 자동으로 정리합니다.
 *
 * @param userId - 알림을 받을 사용자 ID
 * @param payload - 전송할 알림 페이로드
 */
export async function pushNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  // 테스트 환경에서는 console.log로 대체
  if (isTestEnv()) {
    console.log('[push] notification to', userId, JSON.stringify(payload));
    return;
  }

  const supabase = getSupabaseClient();
  const config = getConfig();

  // 해당 userId의 활성 연결 목록 조회
  const { data: connections, error } = await supabase
    .from('ws_connections')
    .select('connection_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[push] ws_connections 조회 실패:', error);
    return;
  }

  if (!connections || connections.length === 0) {
    // 연결된 클라이언트 없음 — 정상 케이스 (오프라인 사용자)
    return;
  }

  const client = new ApiGatewayManagementApiClient({
    endpoint: config.wsEndpoint,
  });

  const messageData = new TextEncoder().encode(JSON.stringify(payload));
  const staleConnectionIds: string[] = [];

  // 모든 활성 연결에 병렬 전송
  await Promise.allSettled(
    connections.map(async ({ connection_id }: { connection_id: string }) => {
      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connection_id,
            Data: messageData,
          }),
        );
      } catch (err) {
        if (err instanceof GoneException) {
          // 연결이 이미 끊어진 경우 정리 대상으로 표시
          staleConnectionIds.push(connection_id);
        } else {
          console.error('[push] 메시지 전송 실패:', connection_id, err);
        }
      }
    }),
  );

  // 끊어진 연결 일괄 정리
  if (staleConnectionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('ws_connections')
      .delete()
      .in('connection_id', staleConnectionIds);

    if (deleteError) {
      console.error('[push] 끊어진 연결 정리 실패:', deleteError);
    }
  }
}

/**
 * 대여 이벤트 알림을 Seller와 Buyer 양쪽에 전송합니다.
 *
 * @param rentalId - 대여 ID
 * @param sellerId - 판매자 ID
 * @param buyerId - 구매자 ID
 * @param type - 알림 타입
 * @param message - 알림 메시지
 * @param data - 추가 데이터
 */
export async function pushRentalNotification(
  rentalId: string,
  sellerId: string,
  buyerId: string,
  type: NotificationType,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const payload: NotificationPayload = {
    type,
    rentalId,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  // Seller와 Buyer에게 동시 전송
  await Promise.allSettled([
    pushNotification(sellerId, payload),
    pushNotification(buyerId, payload),
  ]);
}

/**
 * WebSocket sendMessage 핸들러
 * Direct_Trade 채팅방 전용 1:1 채팅 메시지 처리
 * Clean_Bot 필터링, 경고 누적, 채팅 차단 로직 포함
 * Requirements: 6.4, 6.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.2, 13.3
 */

<<<<<<< HEAD
import { verifyJWT } from '../auth/jwt';
=======
>>>>>>> c130ce5fbf014de924cb03b5543fb319a8c18bcd
import { getSupabaseClient } from '../db/client';
import { AppError, ErrorCodes } from '../common/errors';
import { analyzeMessage } from './cleanbot';
import { pushNotification } from '../notify/push';
import type { NotificationPayload } from '../notify/push';

/** API Gateway WebSocket sendMessage 이벤트 */
interface WebSocketMessageEvent {
  requestContext: {
    connectionId: string;
    routeKey: string;
  };
  body: string | null;
}

/** 클라이언트가 전송하는 메시지 페이로드 */
interface SendMessageBody {
  roomId: string;
  content: string;
  /** Clean_Bot 경고 후 사용자가 "그래도 전송"을 선택한 경우 true */
  forceOverride?: boolean;
}

/** Lambda 응답 */
interface LambdaResponse {
  statusCode: number;
  body: string;
}

/** chat_rooms 행 타입 */
interface ChatRoom {
  id: string;
  rental_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
}

/** chat_messages 행 타입 */
interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  clean_bot_status: string;
  warning_count: number;
  sent_at: string;
}

/** rentals 행 타입 (trade_type 확인용) */
interface Rental {
  id: string;
  trade_type: string;
}

/**
 * WebSocket 연결에서 userId를 조회합니다.
 */
async function getUserIdFromConnection(connectionId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ws_connections')
    .select('user_id')
    .eq('connection_id', connectionId)
    .single();

  if (error || !data) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, '인증된 연결을 찾을 수 없습니다.');
  }
  return data.user_id as string;
}

/**
 * 채팅방 정보를 조회하고 접근 권한을 검증합니다.
 * - Direct_Trade 채팅방만 허용
 * - 채팅방 참여자(seller 또는 buyer)만 접근 가능
 */
async function validateChatRoom(
  roomId: string,
  userId: string,
): Promise<ChatRoom> {
  const supabase = getSupabaseClient();

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .select('id, rental_id, seller_id, buyer_id, status')
    .eq('id', roomId)
    .single();

  if (error || !room) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, '채팅방을 찾을 수 없습니다.');
  }

  const chatRoom = room as ChatRoom;

  // 참여자 확인
  if (chatRoom.seller_id !== userId && chatRoom.buyer_id !== userId) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, '채팅방 접근 권한이 없습니다.');
  }

  // Direct_Trade 여부 확인 (rental의 trade_type 조회)
  const { data: rental, error: rentalError } = await supabase
    .from('rentals')
    .select('id, trade_type')
    .eq('id', chatRoom.rental_id)
    .single();

  if (rentalError || !rental) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, '대여 정보를 찾을 수 없습니다.');
  }

  const rentalData = rental as Rental;
  if (rentalData.trade_type !== 'direct_trade') {
    // Pickup_Zone 채팅 비활성화 (Requirements: 6.4, 12.1)
    throw new AppError(
      403,
      ErrorCodes.FORBIDDEN,
      'Pickup_Zone 거래는 채팅을 지원하지 않습니다.',
    );
  }

  return chatRoom;
}

/**
 * 해당 사용자의 채팅방 내 경고 횟수를 조회합니다.
 */
async function getWarningCount(roomId: string, userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('warning_count')
    .eq('room_id', roomId)
    .eq('sender_id', userId)
    .eq('clean_bot_status', 'warned')
    .order('sent_at', { ascending: false });

  if (error || !data) return 0;

  // 누적 경고 횟수 = warned 상태 메시지 수
  return (data as { warning_count: number }[]).length;
}

/**
 * WebSocket sendMessage 핸들러
 *
 * 처리 흐름:
 * 1. 연결 ID → userId 조회
 * 2. 채팅방 유효성 검증 (Direct_Trade, 참여자 확인)
 * 3. 채팅 차단 여부 확인 (경고 3회 이상)
 * 4. Clean_Bot 분석
 * 5. 메시지 DB 저장
 * 6. 상대방에게 WebSocket 전송
 */
export const handler = async (
  event: WebSocketMessageEvent,
): Promise<LambdaResponse> => {
  const { connectionId } = event.requestContext;

  // 요청 바디 파싱
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: { code: ErrorCodes.VALIDATION_ERROR, message: '메시지 내용이 없습니다.' },
      }),
    };
  }

  let body: SendMessageBody;
  try {
    body = JSON.parse(event.body) as SendMessageBody;
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: { code: ErrorCodes.VALIDATION_ERROR, message: '잘못된 JSON 형식입니다.' },
      }),
    };
  }

  const { roomId, content, forceOverride = false } = body;

  // 입력 유효성 검사
  if (!roomId || typeof roomId !== 'string') {
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: { code: ErrorCodes.VALIDATION_ERROR, message: 'roomId가 필요합니다.' },
      }),
    };
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: { code: ErrorCodes.VALIDATION_ERROR, message: '메시지 내용이 필요합니다.' },
      }),
    };
  }
  if (content.length > 1000) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: '메시지는 1000자를 초과할 수 없습니다.',
        },
      }),
    };
  }

  try {
    // 1. 연결 ID → userId 조회
    const userId = await getUserIdFromConnection(connectionId);

    // 2. 채팅방 유효성 검증
    const room = await validateChatRoom(roomId, userId);

    // 3. 채팅 차단 여부 확인 (경고 3회 이상 → 차단, Requirements: 12.5, 13.3)
    const warningCount = await getWarningCount(roomId, userId);
    if (warningCount >= 3) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: {
            code: ErrorCodes.CHAT_BLOCKED,
            message: '경고 누적으로 채팅이 차단되었습니다. 관리자에게 문의하세요.',
          },
        }),
      };
    }

    // 4. Clean_Bot 분석 (Requirements: 12.3, 13.1, 13.4)
    const cleanBotResult = await analyzeMessage(content);

    const supabase = getSupabaseClient();

    // Clean_Bot 경고 판정 처리 (Requirements: 12.4, 13.2)
    if (cleanBotResult.verdict === 'warned' && !forceOverride) {
      // 경고 메시지 보류 상태로 저장 (수신자에게 즉시 전달하지 않음)
      const { data: savedMsg, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          content,
          clean_bot_status: 'warned',
          warning_count: warningCount + 1,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('[sendMessage] 경고 메시지 저장 실패:', insertError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: { code: ErrorCodes.INTERNAL_ERROR, message: '메시지 저장에 실패했습니다.' },
          }),
        };
      }

      // 경고 로그 기록 (Requirements: 13.2)
      console.warn('[Clean_Bot] 경고 메시지 보류:', {
        userId,
        roomId,
        messageId: (savedMsg as ChatMessage).id,
        reason: cleanBotResult.reason,
        warningCount: warningCount + 1,
        timestamp: new Date().toISOString(),
      });

      // 발신자에게 경고 알림 전송 (클라이언트에서 "그래도 전송" / "취소" 팝업 표시)
      const warningPayload: NotificationPayload = {
        type: 'chat_message',
        message: '메시지에 부적절한 내용이 포함되어 있습니다.',
        data: {
          event: 'clean_bot_warning',
          messageId: (savedMsg as ChatMessage).id,
          reason: cleanBotResult.reason,
          warningCount: warningCount + 1,
          remainingWarnings: Math.max(0, 3 - (warningCount + 1)),
        },
        timestamp: new Date().toISOString(),
      };
      await pushNotification(userId, warningPayload);

      return {
        statusCode: 200,
        body: JSON.stringify({
          event: 'clean_bot_warning',
          messageId: (savedMsg as ChatMessage).id,
          message: '메시지에 부적절한 내용이 포함되어 있습니다. 그래도 전송하시겠습니까?',
          warningCount: warningCount + 1,
          remainingWarnings: Math.max(0, 3 - (warningCount + 1)),
        }),
      };
    }

    // 5. 메시지 DB 저장 (clean 또는 failed 또는 forceOverride)
    const cleanBotStatus =
      cleanBotResult.verdict === 'failed'
        ? 'failed'
        : forceOverride && cleanBotResult.verdict === 'warned'
          ? 'warned'
          : 'clean';

    const { data: savedMsg, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: userId,
        content,
        clean_bot_status: cleanBotStatus,
        warning_count: forceOverride ? warningCount + 1 : warningCount,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !savedMsg) {
      console.error('[sendMessage] 메시지 저장 실패:', insertError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: { code: ErrorCodes.INTERNAL_ERROR, message: '메시지 저장에 실패했습니다.' },
        }),
      };
    }

    const message = savedMsg as ChatMessage;

    // 6. 상대방에게 WebSocket 전송 (Requirements: 6.5)
    const recipientId =
      room.seller_id === userId ? room.buyer_id : room.seller_id;

    const chatPayload: NotificationPayload = {
      type: 'chat_message',
      message: content,
      data: {
        event: 'new_message',
        messageId: message.id,
        roomId,
        senderId: userId,
        content,
        cleanBotStatus,
        sentAt: message.sent_at,
      },
      timestamp: message.sent_at,
    };

    await pushNotification(recipientId, chatPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        event: 'message_sent',
        messageId: message.id,
        sentAt: message.sent_at,
      }),
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({
          error: { code: error.code, message: error.message },
        }),
      };
    }
    console.error('[sendMessage] 예상치 못한 오류:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: { code: ErrorCodes.INTERNAL_ERROR, message: '서버 오류가 발생했습니다.' },
      }),
    };
  }
};

/**
 * 1:1 채팅 페이지 (Direct_Trade 전용)
 * WebSocket을 통한 실시간 메시지 송수신
 * Clean_Bot 경고 팝업 ("그래도 전송" / "취소") 포함
 * Requirements: 6.4, 6.5, 12.4, 13.3, 16.7
 */

import { ArrowLeft, Send, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'other';
  time: string;
  cleanBotStatus?: string;
}

interface CleanBotWarning {
  messageId: string;
  reason: string;
  warningCount: number;
  remainingWarnings: number;
  originalContent: string;
}

type Phase = 'chat' | 'payment' | 'waiting' | 'done';

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { sendChatMessage, subscribe, status } = useWebSocket();

  const roomId = location.state?.roomId || '';
  const product = location.state?.product || {};
  const otherUserName = location.state?.otherUserName || '상대방';

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [warning, setWarning] = useState<CleanBotWarning | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 기존 메시지 로드
  useEffect(() => {
    if (!roomId) return;

    const loadMessages = async () => {
      try {
        const res = await apiClient.get(`/chat/rooms/${roomId}/messages`);
        const loaded = (res.data.messages || []).map((msg: {
          id: string;
          sender_id: string;
          content: string;
          clean_bot_status: string;
          sent_at: string;
        }) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.sender_id === user?.id ? 'me' : 'other',
          time: new Date(msg.sent_at).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          cleanBotStatus: msg.clean_bot_status,
        }));
        setMessages(loaded);
      } catch (err) {
        console.error('메시지 로드 실패:', err);
      }
    };

    loadMessages();
  }, [roomId, user?.id]);

  // WebSocket 메시지 수신
  useEffect(() => {
    const unsubscribe = subscribe('chat_message', (wsMsg) => {
      const data = wsMsg.data as Record<string, unknown> | undefined;
      if (!data) return;

      // Clean_Bot 경고 응답 처리
      if (data.event === 'clean_bot_warning') {
        setWarning({
          messageId: data.messageId as string,
          reason: data.reason as string,
          warningCount: data.warningCount as number,
          remainingWarnings: data.remainingWarnings as number,
          originalContent: message,
        });
        return;
      }

      // 채팅 차단 응답
      if (data.event === 'chat_blocked') {
        setIsBlocked(true);
        return;
      }

      // 새 메시지 수신
      if (data.event === 'new_message' && data.roomId === roomId) {
        const newMsg: Message = {
          id: data.messageId as string,
          text: data.content as string,
          sender: data.senderId === user?.id ? 'me' : 'other',
          time: new Date(data.sentAt as string).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          cleanBotStatus: data.cleanBotStatus as string,
        };
        setMessages(prev => [...prev, newMsg]);
      }
    });

    return unsubscribe;
  }, [subscribe, roomId, user?.id, message]);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!message.trim() || !roomId || isBlocked) return;

    if (message.length > 1000) {
      alert('메시지는 1000자를 초과할 수 없습니다.');
      return;
    }

    // WebSocket으로 메시지 전송
    sendChatMessage(roomId, message.trim());

    // 낙관적 UI 업데이트
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      text: message.trim(),
      sender: 'me',
      time: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setMessage('');
  }, [message, roomId, isBlocked, sendChatMessage]);

  // "그래도 전송" 처리 (Requirements: 12.4, 13.3)
  const handleForceOverride = useCallback(() => {
    if (!warning || !roomId) return;
    sendChatMessage(roomId, warning.originalContent, true);
    setWarning(null);
  }, [warning, roomId, sendChatMessage]);

  // "취소" 처리
  const handleCancelWarning = useCallback(() => {
    setWarning(null);
  }, []);

  // ─── 구매하기 클릭 ───
  const handleBuyClick = () => {
    log('구매하기 클릭 → phase=payment');
    setPhase('payment');
  };

  // ─── 송금 확인 ───
  const handleConfirmPayment = async (role: 'buyer' | 'seller') => {
    if (!roomId) return;
    try {
      const res = await apiClient.post(`/chat/rooms/${roomId}/confirm-payment`, { role });
      if (res.data.bothConfirmed) {
        alert('🎉 양쪽 모두 확인! 거래가 완료되었습니다.');
      } else {
        alert('✅ 확인 완료. 상대방의 확인을 기다립니다.');
      }
      await loadRoom(roomId);
    } catch {
      alert('처리에 실패했습니다.');
    }
  };

  // ─── 신고 ───
  const handleReport = async (messageId: string) => {
    if (!confirm('이 메시지를 신고하시겠습니까?')) return;
    try {
      await apiClient.post('/chat/report', { messageId });
      alert('신고가 완료되었습니다.');
    } catch { alert('신고 처리에 실패했습니다.'); }
  };

  // ─── 로딩 ───
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">채팅방을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{otherUserName}님과 채팅</h1>
            <p className="text-xs text-gray-500">{product.title || 'Direct Trade'}</p>
          </div>
          {/* 연결 상태 표시 */}
          <div className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                status === 'connected'
                  ? 'bg-green-500'
                  : status === 'reconnecting'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-xs text-gray-400">
              {status === 'connected'
                ? '연결됨'
                : status === 'reconnecting'
                  ? '재연결 중...'
                  : '연결 끊김'}
            </span>
          </div>
          {phase === 'done' && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> 거래 완료
            </span>
          )}
        </div>
      </div>

      {/* ═══ 구매자: [구매하기] 버튼 (phase=chat일 때) ═══ */}
      {isBuyer && phase === 'chat' && (
        <div className="bg-purple-50 border-b border-purple-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">이 상품을 구매하시겠어요?</p>
              <p className="text-xs text-purple-600">구매하기를 누르면 판매자 계좌가 공개됩니다.</p>
            </div>
            <button
              onClick={handleBuyClick}
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              구매하기
            </button>
          </div>
        </div>
      )}

      {/* ═══ 구매자: 계좌 공개 + [송금 완료] (phase=payment) ═══ */}
      {isBuyer && phase === 'payment' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4 space-y-3">
          <h3 className="font-bold text-yellow-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> 판매자 계좌 정보
          </h3>
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <p className="text-lg font-bold text-gray-900">
              {product.bank_name || '은행 미등록'} {product.account_number || '계좌 미등록'}
            </p>
            <p className="text-sm text-gray-500 mt-1">위 계좌로 {product.price}을 송금해 주세요.</p>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">내 계좌번호 (환불용)</label>
            <input
              type="text"
              value={buyerAccount}
              onChange={(e) => setBuyerAccount(e.target.value)}
              placeholder="은행명 + 계좌번호 입력"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-400"
            />
          </div>
          <button
            onClick={() => handleConfirmPayment('buyer')}
            className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
          >
            ✅ 송금 완료
          </button>
        </div>
      )}

      {/* ═══ 구매자: 대기 중 (phase=waiting) ═══ */}
      {isBuyer && phase === 'waiting' && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm text-green-800 font-medium">송금 완료 확인됨</p>
              <p className="text-xs text-green-600">판매자의 입금 확인을 기다리고 있습니다...</p>
            </div>
            <Clock className="w-4 h-4 text-green-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* ═══ 판매자: 구매자 송금 후 [입금 확인] ═══ */}
      {isSeller && room?.buyer_confirmed && !room?.seller_confirmed && phase !== 'done' && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 font-medium">💰 구매자가 송금을 완료했습니다</p>
              <p className="text-xs text-blue-600">계좌 입금을 확인한 후 버튼을 눌러주세요.</p>
            </div>
            <button
              onClick={() => handleConfirmPayment('seller')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors"
            >
              ✅ 입금 확인
            </button>
          </div>
        </div>
      )}

      {/* Blocked Banner */}
      {isBlocked && (
        <div className="bg-red-50 border-b border-red-200 px-8 py-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              경고 누적으로 채팅이 차단되었습니다. 관리자에게 문의하세요.
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>메시지가 없습니다.</p>
              <p className="text-sm mt-1">상대방에게 첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs ${
                    msg.sender === 'me'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-900'
                  } rounded-xl px-4 py-3 shadow-sm`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.sender === 'me' ? 'text-purple-200' : 'text-gray-400'
                    }`}
                  >
                    {msg.time}
                  </p>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Clean_Bot Warning Dialog */}
      {warning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Clean_Bot 경고</h3>
                <p className="text-xs text-gray-500">
                  경고 {warning.warningCount}/3 (남은 횟수: {warning.remainingWarnings})
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-2">
              메시지에 부적절한 내용이 포함되어 있습니다.
            </p>
            {warning.reason && (
              <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded">
                사유: {warning.reason}
              </p>
            )}
            {warning.remainingWarnings === 0 && (
              <p className="text-xs text-red-600 mb-4 font-medium">
                ⚠️ 이 메시지를 전송하면 채팅이 차단됩니다.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleCancelWarning}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleForceOverride}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                그래도 전송
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isBlocked ? '채팅이 차단되었습니다' : '메시지를 입력하세요'}
            disabled={isBlocked || status !== 'connected'}
            maxLength={1000}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400 disabled:opacity-50 disabled:bg-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={isBlocked || !message.trim() || status !== 'connected'}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ═══ 디버그 패널 (개발 중 확인용 — 배포 시 제거) ═══ */}
      <details className="bg-gray-900 text-green-400 text-xs p-2">
        <summary className="cursor-pointer">🐛 Debug Log</summary>
        <div className="mt-1 space-y-0.5 font-mono max-h-32 overflow-auto">
          <p>user: {user?.id?.slice(0,8) || 'null'} | roomId: {roomId?.slice(0,8) || 'null'} | phase: {phase}</p>
          <p>isBuyer: {String(isBuyer)} | isSeller: {String(isSeller)} | room: {room ? 'loaded' : 'null'}</p>
          <p>buyer_confirmed: {String(room?.buyer_confirmed)} | seller_confirmed: {String(room?.seller_confirmed)}</p>
          {debugLog.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </details>
    </div>
  );
}

/**
 * 1:1 채팅 페이지 — 구매/송금 프로세스 통합
 * 실시간 인앱 알림(토스트) + 디버깅 로그 포함 버전
 */

import { ArrowLeft, Send, CreditCard, CheckCircle2, Clock, Flag, Bell } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sent_at: string;
}

interface RoomData {
  id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
}

/** 인앱 알림 토스트 데이터 */
interface ToastNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
}

type Phase = 'chat' | 'payment' | 'waiting' | 'done';

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const product = location.state?.product || {};
  const passedRoomId: string | null = location.state?.roomId || null;

  // Core state
  const [roomId, setRoomId] = useState<string | null>(passedRoomId);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('chat');
  const [buyerAccount, setBuyerAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // 실시간 알림 토스트 상태
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());

  // 디버그 로그 추가 함수
  const log = (msg: string) => {
    console.log(`[Chat] ${msg}`);
    setDebugLog((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()} ${msg}`]);
  };

  // ─── 실시간 인앱 알림 토스트 ───
  const showToast = useCallback((title: string, body: string) => {
    const toast: ToastNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      body,
      timestamp: Date.now(),
    };
    setToasts((prev) => [...prev, toast]);
    log(`🔔 토스트 알림: ${title} — ${body.slice(0, 30)}`);
  }, []);

  // 토스트 자동 제거 (4초)
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // 역할 판별 — room 데이터가 있으면 room 기준, 없으면 product.seller_id로 추론
  // ⚠️ 상호 배타적: isBuyer와 isSeller는 절대 동시에 true가 될 수 없음
  const isBuyer = (() => {
    if (!user?.id) return false;
    if (room) return user.id === room.buyer_id;
    // room이 없을 때: seller_id(또는 owner_id)와 다르면 구매자
    const sellerId = product.seller_id || product.owner_id;
    return !!(sellerId && user.id !== sellerId);
  })();
  const isSeller = (() => {
    if (!user?.id) return false;
    if (room) return user.id === room.seller_id;
    const sellerId = product.seller_id || product.owner_id;
    return !!(sellerId && user.id === sellerId);
  })();

  // Phase 계산 — 구매자/판매자 각각의 시점에서 올바른 상태 표시
  useEffect(() => {
    if (!room) return;
    if (room.buyer_confirmed && room.seller_confirmed) {
      setPhase('done');
    } else if (isBuyer && room.buyer_confirmed && !room.seller_confirmed) {
      setPhase('waiting');
    } else if (isSeller && room.buyer_confirmed && !room.seller_confirmed) {
      // 판매자 입장: 구매자가 송금완료 누름 → 입금확인 버튼 표시 (chat 상태 유지)
      setPhase('chat');
    } else if (phase !== 'payment') {
      setPhase('chat');
    }
  }, [room, isBuyer, isSeller]);

  // 메시지 로드 — 새 메시지 감지 시 토스트 알림
  const loadMessages = async (rid: string) => {
    try {
      const res = await apiClient.get(`/chat/rooms/${rid}/messages`);
      const newMessages: ChatMessage[] = res.data.messages || [];

      // 새 메시지 감지: 상대방이 보낸 메시지가 새로 추가됐으면 토스트
      if (prevMessageIdsRef.current.size > 0) {
        const newOnes = newMessages.filter(
          (msg) => !prevMessageIdsRef.current.has(msg.id) && msg.sender_id !== user?.id
        );
        if (newOnes.length > 0) {
          const latest = newOnes[newOnes.length - 1];
          showToast('새 메시지', latest.content.slice(0, 50));
        }
      }

      // 메시지 ID 세트 업데이트
      prevMessageIdsRef.current = new Set(newMessages.map((m) => m.id));
      prevMessageCountRef.current = newMessages.length;
      setMessages(newMessages);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: unknown } };
      log(`메시지 로드 실패: status=${e?.response?.status} data=${JSON.stringify(e?.response?.data)}`);
    }
  };

  // 방 정보 로드
  const loadRoom = async (rid: string) => {
    try {
      const res = await apiClient.get('/chat/rooms');
      const rooms: RoomData[] = res.data.rooms || [];
      const found = rooms.find((r) => r.id === rid);
      if (found) {
        setRoom(found);
        log(`방 로드 성공: buyer=${found.buyer_id?.slice(0,8)} seller=${found.seller_id?.slice(0,8)} status=${found.status}`);
      } else {
        log(`방 목록에서 ${rid.slice(0,8)} 못 찾음 (총 ${rooms.length}개)`);
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      log(`방 로드 실패: ${e?.response?.status}`);
    }
  };

  // 초기화
  useEffect(() => {
    if (!user?.id) {
      log('유저 없음 — 로그인 필요');
      setLoading(false);
      return;
    }

    log(`초기화 시작: user=${user.id.slice(0,8)} roomId=${passedRoomId?.slice(0,8) || 'null'} product.id=${product.id || 'null'}`);

    const init = async () => {
      try {
        let rid = passedRoomId;

        // 채팅방 생성/조회
        if (!rid && product.id) {
          log(`채팅방 생성 요청: productId=${product.id} sellerId=${product.owner_id}`);
          const res = await apiClient.post('/chat/rooms', {
            productId: product.id,
            sellerId: product.owner_id || product.seller_id,
          });
          rid = res.data.room.id;
          setRoom(res.data.room);
          log(`채팅방 생성 완료: roomId=${rid}`);
        }

        if (rid) {
          setRoomId(rid);
          await loadMessages(rid);
          await loadRoom(rid);
          log('초기화 완료');
        } else {
          log('roomId를 확보하지 못함');
        }
      } catch (err: unknown) {
        const e = err as { response?: { status?: number; data?: unknown }; message?: string };
        log(`초기화 에러: ${e?.response?.status || e?.message || 'unknown'}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user?.id]);

  // 폴링 (3초)
  useEffect(() => {
    if (!roomId) return;
    pollRef.current = setInterval(async () => {
      await loadMessages(roomId);
      await loadRoom(roomId);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [roomId]);

  // 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── 메시지 전송 ───
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !roomId) {
      log(`전송 불가: text=${!!text} roomId=${roomId}`);
      return;
    }

    setInput('');
    setSending(true);
    log(`전송 시작: roomId=${roomId.slice(0,8)} text="${text.slice(0,20)}"`);

    try {
      const res = await apiClient.post(`/chat/rooms/${roomId}/messages`, { content: text });
      log(`전송 응답: ${JSON.stringify(res.data).slice(0,100)}`);

      if (res.data.event === 'clean_bot_warning') {
        alert('⚠️ 비속어가 포함된 메시지입니다. 전송이 차단되었습니다.');
        setInput(text);
        return;
      }

      // 즉시 갱신
      await loadMessages(roomId);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
      const serverMsg = e?.response?.data?.error?.message || e?.message || 'unknown';
      const status = e?.response?.status;
      log(`전송 실패: status=${status} msg=${serverMsg}`);
      setInput(text);

      if (status === 401) {
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      } else {
        alert(`전송 실패: ${serverMsg}`);
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

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
      {/* ═══ 실시간 알림 토스트 (화면 상단) ═══ */}
      {toasts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-md">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white border border-purple-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-[slideDown_0.3s_ease-out]"
            >
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
                <p className="text-xs text-gray-600 truncate">{toast.body}</p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-gray-400 hover:text-gray-600 text-xs flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{isSeller ? '구매자와 채팅' : '판매자와 채팅'}</h1>
            {product.title && <p className="text-xs text-gray-500">{product.title}</p>}
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

      {/* ═══ 거래 완료 ═══ */}
      {phase === 'done' && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-4 text-center">
          <p className="text-green-800 font-bold text-lg">🎉 거래가 완료되었습니다!</p>
        </div>
      )}

      {/* ═══ Messages ═══ */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>메시지가 없습니다.</p>
              <p className="text-sm mt-1">첫 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                  <div className={`flex items-end gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      isMe ? 'bg-purple-600 text-white' : 'bg-white text-gray-900 border border-gray-100'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                        {new Date(msg.sent_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!isMe && (
                      <button
                        onClick={() => handleReport(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-500"
                        title="신고하기"
                      >
                        <Flag className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ═══ Input ═══ */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요"
            disabled={sending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl transition-colors disabled:opacity-50"
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

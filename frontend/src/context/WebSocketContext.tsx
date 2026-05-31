/**
 * WebSocket 전역 상태 관리 Context
 * 연결 관리, 30초 간격 최대 5회 재연결, 메시지 라우팅을 담당합니다.
 * Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 16.6
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { getAuthToken } from '../api/client';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type WsConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export type WsMessageType =
  | 'chat_message'
  | 'rental_requested'
  | 'rental_confirmed'
  | 'rental_returned'
  | 'rental_damaged'
  | 'return_reminder'
  | 'deposit_refunded';

export interface WsMessage {
  type: WsMessageType;
  rentalId?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

type MessageHandler = (message: WsMessage) => void;

interface WebSocketContextValue {
  status: WsConnectionStatus;
  sendChatMessage: (roomId: string, content: string, forceOverride?: boolean) => void;
  subscribe: (type: WsMessageType | '*', handler: MessageHandler) => () => void;
  reconnect: () => void;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const WS_BASE_URL = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_WS_URL;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 30_000;

// ─── Context ──────────────────────────────────────────────────────────────────

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<WsConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());

  const dispatchMessage = useCallback((message: WsMessage) => {
    handlersRef.current.get(message.type)?.forEach((h) => h(message));
    handlersRef.current.get('*')?.forEach((h) => h(message));
  }, []);

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (!token || !WS_BASE_URL) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');
    const ws = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        dispatchMessage(JSON.parse(event.data) as WsMessage);
      } catch {
        console.warn('[WebSocket] 메시지 파싱 실패:', event.data);
      }
    };

    ws.onerror = (err) => console.error('[WebSocket] 오류:', err);

    ws.onclose = () => {
      wsRef.current = null;
      const attempts = reconnectAttemptsRef.current;
      if (attempts >= MAX_RECONNECT_ATTEMPTS) {
        setStatus('failed');
        window.dispatchEvent(new CustomEvent('ws:failed'));
        return;
      }
      setStatus('reconnecting');
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
    };
  }, [dispatchMessage]);

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  const sendChatMessage = useCallback(
    (roomId: string, content: string, forceOverride = false) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[WebSocket] 연결이 없어 메시지를 전송할 수 없습니다.');
        return;
      }
      wsRef.current.send(
        JSON.stringify({ action: 'sendMessage', roomId, content, forceOverride }),
      );
    },
    [],
  );

  const subscribe = useCallback(
    (type: WsMessageType | '*', handler: MessageHandler): (() => void) => {
      if (!handlersRef.current.has(type)) {
        handlersRef.current.set(type, new Set());
      }
      handlersRef.current.get(type)!.add(handler);
      return () => handlersRef.current.get(type)?.delete(handler);
    },
    [],
  );

  // 로그인 상태 변경 시 연결/해제
  useEffect(() => {
    if (getAuthToken()) connect();

    const handleLogout = () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('disconnected');
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      handleLogout();
    };
  }, [connect]);

  const value = useMemo<WebSocketContextValue>(
    () => ({ status, sendChatMessage, subscribe, reconnect }),
    [status, sendChatMessage, subscribe, reconnect],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket은 WebSocketProvider 내부에서 사용해야 합니다.');
  return context;
}

export default WebSocketContext;

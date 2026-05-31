/**
 * 실시간 알림 전역 상태 관리 Context
 * Requirements: 6.1, 6.2, 6.3, 6.7, 16.6
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { useWebSocket, type WsMessage } from './WebSocketContext';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: WsMessage['type'];
  message: string;
  rentalId?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  isRead: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  showConnectionError: boolean;
}

type NotificationAction =
  | { type: 'ADD'; payload: Notification }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'REMOVE'; payload: string }
  | { type: 'CLEAR' }
  | { type: 'SET_CONNECTION_ERROR'; payload: boolean };

interface NotificationContextValue extends NotificationState {
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  dismissConnectionError: () => void;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 50;

function reducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD': {
      const notifications = [action.payload, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return { ...state, notifications, unreadCount: state.unreadCount + 1 };
    }
    case 'MARK_READ': {
      const notifications = state.notifications.map((n) =>
        n.id === action.payload ? { ...n, isRead: true } : n,
      );
      return { ...state, notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
    }
    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, isRead: true })), unreadCount: 0 };
    case 'REMOVE': {
      const notifications = state.notifications.filter((n) => n.id !== action.payload);
      return { ...state, notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
    }
    case 'CLEAR':
      return { ...state, notifications: [], unreadCount: 0 };
    case 'SET_CONNECTION_ERROR':
      return { ...state, showConnectionError: action.payload };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationContextValue | null>(null);

const NOTIFICATION_LABELS: Partial<Record<WsMessage['type'], string>> = {
  rental_requested: '새 대여 요청이 도착했습니다.',
  rental_confirmed: '대여가 확정되었습니다.',
  rental_returned: '물품이 반납되었습니다.',
  rental_damaged: '파손 신고가 접수되었습니다.',
  return_reminder: '반납 기한이 임박했습니다.',
  deposit_refunded: '보증금이 환불되었습니다.',
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, {
    notifications: [],
    unreadCount: 0,
    showConnectionError: false,
  });

  const { subscribe, status } = useWebSocket();

  // 알림 타입 구독 (chat_message 제외)
  useEffect(() => {
    const types: WsMessage['type'][] = [
      'rental_requested', 'rental_confirmed', 'rental_returned',
      'rental_damaged', 'return_reminder', 'deposit_refunded',
    ];
    const unsubs = types.map((type) =>
      subscribe(type, (msg: WsMessage) => {
        dispatch({
          type: 'ADD',
          payload: {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            type: msg.type,
            message: NOTIFICATION_LABELS[msg.type] ?? msg.message,
            rentalId: msg.rentalId,
            data: msg.data,
            timestamp: msg.timestamp,
            isRead: false,
          },
        });
      }),
    );
    return () => unsubs.forEach((u) => u());
  }, [subscribe]);

  // WebSocket 연결 실패 시 오류 표시
  useEffect(() => {
    if (status === 'failed') dispatch({ type: 'SET_CONNECTION_ERROR', payload: true });
  }, [status]);

  useEffect(() => {
    const handler = () => dispatch({ type: 'SET_CONNECTION_ERROR', payload: true });
    window.addEventListener('ws:failed', handler);
    return () => window.removeEventListener('ws:failed', handler);
  }, []);

  const markAsRead = useCallback((id: string) => dispatch({ type: 'MARK_READ', payload: id }), []);
  const markAllAsRead = useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), []);
  const removeNotification = useCallback((id: string) => dispatch({ type: 'REMOVE', payload: id }), []);
  const clearAll = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const dismissConnectionError = useCallback(() => dispatch({ type: 'SET_CONNECTION_ERROR', payload: false }), []);

  const value = useMemo<NotificationContextValue>(
    () => ({ ...state, markAsRead, markAllAsRead, removeNotification, clearAll, dismissConnectionError }),
    [state, markAsRead, markAllAsRead, removeNotification, clearAll, dismissConnectionError],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications는 NotificationProvider 내부에서 사용해야 합니다.');
  return context;
}

export default NotificationContext;

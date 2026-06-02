/**
 * 전역 알림 토스트 컴포넌트
 * Supabase Realtime으로 notifications 테이블을 구독하여
 * 현재 로그인한 유저의 새 알림이 INSERT되는 즉시 토스트 팝업을 표시합니다.
 * App.tsx 최상단에 마운트 — 어떤 페이지에서든 동작.
 */

import { useState, useEffect, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 (Realtime 전용)
const supabaseUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL ?? '';
const supabaseKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Toast {
  id: string;
  title: string;
  body: string;
}

function parseContent(content: string): { title: string; body: string } {
  try {
    const parsed = JSON.parse(content);
    return { title: parsed.title || '알림', body: parsed.body || content };
  } catch {
    return { title: '알림', body: content };
  }
}

export default function GlobalNotificationToast() {
  const { user, isAuthenticated } = useAuth();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 토스트 자동 제거 (5초)
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Supabase Realtime 구독 — user_id == 내 ID인 INSERT 감지
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; content: string; type: string };
          const { title, body } = parseContent(row.content);

          setToasts((prev) => {
            // 중복 방지
            if (prev.find((t) => t.id === row.id)) return prev;
            return [...prev, { id: row.id, title, body }].slice(-5); // 최대 5개
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90%] max-w-md">
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
            onClick={() => dismissToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

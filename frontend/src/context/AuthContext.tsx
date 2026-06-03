/**
 * 인증 전역 상태 관리 Context
 * JWT 토큰(메모리 저장), 사용자 정보, 로그인/로그아웃 액션을 제공합니다.
 * Requirements: 2.1, 2.4, 16.1
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { setAuthToken, clearAuthToken } from '../api/client';
import { login as apiLogin, type LoginRequest } from '../api/auth';
import { supabase } from '../lib/supabase';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  isVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { user: AuthUser; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_USER'; payload: Partial<AuthUser> };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'LOGOUT':
      return { ...initialState };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // ─── 앱 시작 시 세션 복원 (새로고침 시 로그인 유지) ────────────────────────
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem('haruman_token');
      const savedUser = localStorage.getItem('haruman_user');

      if (savedToken && savedUser) {
        const user = JSON.parse(savedUser);
        setAuthToken(savedToken);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            token: savedToken,
            user: {
              id: user.id,
              email: user.email,
              nickname: user.nickname || '',
              role: user.role || 'user',
              isVerified: user.is_verified ?? true,
            },
          },
        });
      }
    } catch {
      // 복원 실패 시 무시 — 로그인 페이지에서 다시 로그인하면 됨
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // 1. 백엔드 로그인 (기존 방식 유지)
      const data = await apiLogin({ email, password } as LoginRequest);
      setAuthToken(data.token);

      // 2. Supabase Auth에도 로그인 시도 (세션 저장용 — 비블로킹, 실패 무시)
      supabase.auth.signInWithPassword({ email, password }).catch(() => {});

      // 3. localStorage에 토큰 저장 (새로고침 시 복원용)
      localStorage.setItem('haruman_token', data.token);
      localStorage.setItem('haruman_user', JSON.stringify(data.user));

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          token: data.token,
          user: {
            id: data.user.id,
            email: data.user.email,
            nickname: data.user.nickname,
            role: data.user.role || 'user',
            isVerified: data.user.is_verified,
          },
        },
      });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    localStorage.removeItem('haruman_token');
    localStorage.removeItem('haruman_user');
    supabase.auth.signOut().catch(() => {});
    dispatch({ type: 'LOGOUT' });
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    dispatch({ type: 'UPDATE_USER', payload: updates });
  }, []);

  // 401 이벤트 수신 시 자동 로그아웃
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthToken();
      localStorage.removeItem('haruman_token');
      localStorage.removeItem('haruman_user');
      dispatch({ type: 'LOGOUT' });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, updateUser }),
    [state, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}

export default AuthContext;

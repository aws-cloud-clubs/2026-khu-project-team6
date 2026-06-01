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
import { setAuthToken, clearAuthToken, getAuthToken, setSuppressUnauthorizedRedirect } from '../api/client';
import { login as apiLogin, type LoginRequest } from '../api/auth';
import { getMyProfile } from '../api/users';

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
  isLoading: true, // 세션 복원 중에는 로딩 상태로 시작
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
      return { ...initialState, isLoading: false };
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

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await apiLogin({ email, password } as LoginRequest);
      setAuthToken(data.token);
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          token: data.token,
          user: {
            id: data.user.id,
            email: data.user.email,
            nickname: data.user.nickname,
            role: data.user.role,
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
      dispatch({ type: 'LOGOUT' });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // 앱 마운트 시 localStorage에서 토큰 복원 및 유저 정보 재조회
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = getAuthToken();
      if (!savedToken) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        setSuppressUnauthorizedRedirect(true);
        setAuthToken(savedToken);
        const profile = await getMyProfile();
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            token: savedToken,
            user: {
              id: profile.id,
              email: profile.email,
              nickname: profile.nickname,
              role: profile.role,
              isVerified: profile.is_verified,
            },
          },
        });
      } catch {
        clearAuthToken();
        dispatch({ type: 'SET_LOADING', payload: false });
      } finally {
        setSuppressUnauthorizedRedirect(false);
      }
    };

    restoreSession();
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

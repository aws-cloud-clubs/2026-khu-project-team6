import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router';
import { useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { WebSocketProvider } from '../context/WebSocketContext';
import { NotificationProvider } from '../context/NotificationContext';
import { supabase } from '../lib/supabase';
import GlobalNotificationToast from './components/GlobalNotificationToast';
import Home from './pages/Home';
import MainApp from './pages/MainApp';
import Login from './pages/Login';
import Register from './pages/Register';
import Signup from './pages/Signup';
import CompleteProfile from './pages/CompleteProfile';
import Rental from './pages/Rental';
import ProductDetail from './pages/ProductDetail';
import CheckedItems from './pages/CheckedItems';
import MyPage from './pages/MyPage';
import MyRentals from './pages/MyRentals';
import ProductRegister from './pages/ProductRegister';
import EditProfile from './pages/EditProfile';
import Order from './pages/Order';
import Chat from './pages/Chat';
import AdminChat from './pages/AdminChat';

/**
 * 인증 상태 감지 컴포넌트
 * 메일 링크 클릭 후 리다이렉트 시 SIGNED_IN 이벤트를 감지하여
 * nickname이 없으면 /complete-profile로 보냄
 */
function AuthRedirectHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const metadata = session.user.user_metadata;
        // nickname이 없으면 아직 프로필 미완성 → Step 2로
        if (!metadata?.nickname) {
          navigate('/complete-profile', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            {/* 전역 알림 토스트 (모든 페이지에서 동작) */}
            <GlobalNotificationToast />
            {/* 인증 리다이렉트 감지 (라우터 내부에서 동작) */}
            <AuthRedirectHandler />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/app" element={<MainApp />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/rental" element={<Rental />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/checked-items" element={<CheckedItems />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/my-rentals" element={<MyRentals />} />
              <Route path="/product-register" element={<ProductRegister />} />
              <Route path="/edit-profile" element={<EditProfile />} />
              <Route path="/order" element={<Order />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/admin-chat" element={<AdminChat />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

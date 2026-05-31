import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { WebSocketProvider } from '../context/WebSocketContext';
import { NotificationProvider } from '../context/NotificationContext';
import Home from './pages/Home';
import MainApp from './pages/MainApp';
import Login from './pages/Login';
import Signup from './pages/Signup';
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

export default function App() {
  return (
    <BrowserRouter>
      {/* Auth → WebSocket → Notification 순서로 중첩 */}
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/app" element={<MainApp />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
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
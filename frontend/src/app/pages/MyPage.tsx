import { ArrowLeft, User, Package, LogOut, Bell, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile } from '../../api/users';
import type { UserProfile } from '../../api/users';
import apiClient from '../../api/client';

interface ChatRoomItem {
  id: string;
  rental_id: string;
  seller_id: string;
  buyer_id: string;
  status: string;
  lastMessage: string | null;
  lastMessageAt: string;
}

interface NotificationItem {
  id: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
}

export default function MyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoomItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    getMyProfile()
      .then(setProfile)
      .catch(() => {});

    // 채팅방 목록 로드
    apiClient.get('/chat/rooms')
      .then((res) => setChatRooms(res.data.rooms || []))
      .catch(() => {});

    // 알림 목록 로드
    apiClient.get('/notifications')
      .then((res) => {
        const notifs = res.data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: NotificationItem) => n.status !== 'read').length);
      })
      .catch(() => {});
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold flex-1">마이페이지</h1>
          {/* 알림 벨 아이콘 */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* 알림 패널 */}
        {showNotifications && (
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-gray-200">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              알림함
            </h3>
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">알림이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkRead(notif.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      notif.status !== 'read' ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-800 flex-1">{notif.content}</p>
                      {notif.status !== 'read' && (
                        <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notif.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 프로필 */}
        <button
          onClick={() => navigate('/edit-profile')}
          className="w-full bg-white rounded-xl p-6 mb-6 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white">
              <User className="w-8 h-8" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-xl font-bold mb-1">{profile?.nickname ?? '로딩 중...'}</h2>
              <p className="text-sm text-gray-500">{profile?.real_name}</p>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>
            <span className="text-gray-400">›</span>
          </div>
        </button>

        {/* 채팅 내역 리스트 */}
        {chatRooms.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm mb-6">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                채팅 내역
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {chatRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => navigate('/chat', { state: { roomId: room.id, product: {} } })}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {room.seller_id === user?.id ? '구매자' : '판매자'}와의 대화
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {room.lastMessage || '메시지 없음'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs text-gray-400">
                      {new Date(room.lastMessageAt).toLocaleDateString('ko-KR')}
                    </p>
                    {room.status === 'paid' && (
                      <span className="text-xs text-green-600 font-medium">거래완료</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메뉴 */}
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-200">
          <button
            onClick={() => navigate('/my-rentals')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-600" />
              <span className="font-medium">대여 내역</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/product-register')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-gray-600" />
              <span className="font-medium">상품 등록</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-gray-600" />
              <span className="font-medium">로그아웃</span>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}

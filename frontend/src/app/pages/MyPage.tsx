import { ArrowLeft, User, Package, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getMyProfile } from '../../api/users';
import type { UserProfile } from '../../api/users';

export default function MyPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    getMyProfile()
      .then(setProfile)
      .catch(() => {/* 오류 시 AuthContext가 401 처리 */});
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">마이페이지</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8">
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

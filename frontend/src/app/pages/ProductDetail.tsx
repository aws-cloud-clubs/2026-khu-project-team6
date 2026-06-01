/**
 * 상품 상세 페이지
 * - 구매자: "판매자에게 문의하기" → 채팅방 진입 (채팅 내에서 구매하기 가능)
 * - 판매자 본인: "구매자와 대화하기" → 해당 상품 채팅방 목록으로 이동
 * - 픽업존: "픽업존 대여하기" → 주문 페이지
 */

import { ArrowLeft, MessageCircle, ShoppingBag } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../../context/AuthContext';

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const product = location.state?.product || {
    id: '',
    title: '상품명',
    price: '0원',
    image: '',
    tradeMethod: '직거래',
    owner_id: '',
    bank_name: '',
    account_number: '',
  };

  const isOwner = !!(user?.id && product.owner_id && user.id === product.owner_id);

  const handleAction = () => {
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    if (product.tradeMethod === '픽업존') {
      navigate('/order', { state: { product } });
      return;
    }

    if (isOwner) {
      // 판매자 본인 → 마이페이지 채팅 리스트로 이동
      navigate('/mypage');
      return;
    }

    // 구매자 → 채팅방 진입 (채팅 내에서 구매하기 버튼 제공)
    navigate('/chat', { state: { product } });
  };

  // 버튼 문구 + 아이콘
  const getButtonConfig = () => {
    if (product.tradeMethod === '픽업존') {
      return { text: '픽업존 대여하기', icon: <ShoppingBag className="w-5 h-5" /> };
    }
    if (isOwner) {
      return { text: '구매자와 대화하기', icon: <MessageCircle className="w-5 h-5" /> };
    }
    return { text: '판매자에게 문의하기', icon: <MessageCircle className="w-5 h-5" /> };
  };

  const btnConfig = getButtonConfig();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">상품 상세</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex gap-8">
          {/* Image */}
          <div className="flex-1">
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
              {product.image ? (
                <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">이미지 없음</div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold">{product.title}</h2>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  product.tradeMethod === '픽업존' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {product.tradeMethod}
                </span>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-2">{product.price}</div>
            </div>

            {product.description && (
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {/* 계좌 정보 (판매자 본인에게만 표시) */}
            {isOwner && product.bank_name && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">등록된 계좌 정보</p>
                <p className="text-sm font-medium">{product.bank_name} {product.account_number}</p>
              </div>
            )}

            <button
              onClick={handleAction}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {btnConfig.icon}
              {btnConfig.text}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

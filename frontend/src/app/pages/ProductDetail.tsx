import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || {
    id: 1,
    title: '상품명',
    price: '0원',
    image: '',
    tradeMethod: '직거래', // 기본값
  };

  const handleOrder = () => {
    if (product.tradeMethod === '픽업존') {
      navigate('/order', { state: { product } });
    } else {
      // 직거래인 경우 채팅 페이지로 이동
      navigate('/chat', { state: { product } });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">상품 상세</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex gap-8">
          {/* Left - Image */}
          <div className="flex-1">
            <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Right - Product Info */}
          <div className="flex-1">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold">{product.title}</h2>
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                  product.tradeMethod === '픽업존'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {product.tradeMethod}
                </span>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-2">{product.price}</div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>배송 · 23</span>
                <span>조회 3</span>
                <span>찜 1</span>
              </div>
            </div>

            <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
              <div className="flex">
                <div className="w-24 text-sm text-gray-600">보관장소</div>
                <div className="flex-1 text-sm">자도래요</div>
              </div>
              <div className="flex">
                <div className="w-24 text-sm text-gray-600">생산시점</div>
                <div className="flex-1 text-sm">새 상품 (미사용)</div>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="text-sm font-medium mb-2">바꿀랑 써드랑한다</div>
              <div className="text-sm text-gray-600">(텐덴카 카드 혜와)</div>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="text-sm font-medium mb-2">배송비 (?)</div>
              <div className="text-sm text-gray-600 mb-1">당일 2,000원</div>
              <div className="text-sm text-gray-600">CJ대한통운 2,000원</div>
            </div>

            <div className="mb-8">
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">#카드</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">#지갑</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">#명함기타</span>
              </div>
            </div>

            <button
              onClick={handleOrder}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors"
            >
              {product.tradeMethod === '픽업존' ? '픽업존 대여하기' : '판매자에게 문의하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

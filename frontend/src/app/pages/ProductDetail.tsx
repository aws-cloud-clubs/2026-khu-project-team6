import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export default function ProductDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || {
    id: '',
    title: '상품명',
    price: '0원',
    image: '',
    tradeMethod: '직거래',
  };

  const handleOrder = () => {
    if (product.tradeMethod === '픽업존') {
      navigate('/order', { state: { product } });
    } else {
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
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  이미지 없음
                </div>
              )}
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
            </div>

            {product.description && (
              <div className="mb-6 pb-6 border-b border-gray-200">
                <p className="text-sm text-gray-700">{product.description}</p>
              </div>
            )}

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

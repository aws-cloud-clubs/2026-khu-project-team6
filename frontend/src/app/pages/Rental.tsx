import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import apiClient from '../../api/client';

interface RentalProduct {
  id: string;
  title: string;
  price: string;
  image: string;
  tradeMethod: string;
}

export default function Rental() {
  const navigate = useNavigate();
  const location = useLocation();
  const itemTitle = location.state?.itemTitle || '상품';

  const [rentalProducts, setRentalProducts] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ items: RentalProduct[] }>('/items')
      .then((res) => setRentalProducts(res.data.items || []))
      .catch(() => setRentalProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{itemTitle} 대여하기</h1>
        </div>
      </div>

      {/* Products Grid */}
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="text-center py-20 text-gray-400">상품을 불러오는 중...</div>
          ) : rentalProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {rentalProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`, { state: { product } })}
                  className="bg-white rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <div className="relative aspect-square bg-gray-100">
                    <img
                      src={product.image}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        product.tradeMethod === '픽업존'
                          ? 'bg-blue-500 text-white'
                          : 'bg-green-500 text-white'
                      }`}>
                        {product.tradeMethod}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-bold text-sm mb-1">{product.price}</div>
                    <div className="text-xs text-gray-600 line-clamp-2">
                      {product.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">등록된 대여 상품이 없습니다.</p>
              <p className="text-sm mt-2">상품을 등록해보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

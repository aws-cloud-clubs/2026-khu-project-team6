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

export default function CheckedItems() {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkedItems, category } = location.state || { checkedItems: [], category: '' };
  const [selectedItem, setSelectedItem] = useState<any>(checkedItems[0] || null);
  const [rentalProducts, setRentalProducts] = useState<RentalProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) return;

    setLoading(true);

    // 카테고리 필터는 항상 적용, 선택된 아이템이 있으면 subcategory도 필터
    const params: Record<string, string> = { category };
    if (selectedItem && selectedItem.title) {
      params.subcategory = selectedItem.title;
    }

    apiClient
      .get<{ items: RentalProduct[] }>('/items', { params })
      .then((res) => setRentalProducts(res.data.items || []))
      .catch(() => setRentalProducts([]))
      .finally(() => setLoading(false));
  }, [category, selectedItem]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/app')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">{category} 준비 체크리스트</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1">
        {/* Left Sidebar - Checked Items */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-auto">
          <p className="text-sm text-gray-600 mb-6">체크된 물품</p>

          <div className="space-y-3">
            {checkedItems.map((item: any) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
                  selectedItem?.id === item.id
                    ? 'bg-purple-50 border-2 border-purple-300'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-5 h-5 rounded border-2 flex items-center justify-center bg-purple-600 border-purple-600">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.title}</div>
                </div>
              </div>
            ))}
          </div>

          {checkedItems.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">
              체크한 항목이 없습니다.
            </div>
          )}
        </div>

        {/* Right - Rental Products */}
        <div className="flex-1 overflow-auto">
          {selectedItem ? (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">{selectedItem.title}</h2>
                <p className="text-sm text-gray-600">대여 가능한 상품을 선택하세요</p>
              </div>

              {loading ? (
                <div className="text-center py-20 text-gray-400">상품을 불러오는 중...</div>
              ) : rentalProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                  <p>등록된 대여 상품이 없습니다.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-400">
                <p className="text-lg">왼쪽에서 물품을 선택하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';

interface Rental {
  id: string;
  productName: string;
  image: string;
  price: string;
  rentalDate: string;
  status: string;
  tradeMethod: string;
}

export default function MyRentals() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    apiClient
      .get<{ rentals: Rental[] }>('/rentals/me')
      .then((res) => setRentals(res.data.rentals || []))
      .catch(() => setRentals([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, navigate]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '대여 중':
        return 'text-purple-600';
      case '반납 완료':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleRentalClick = (rental: Rental) => {
    if (rental.tradeMethod === '직거래') {
      const product = {
        id: rental.id,
        title: rental.productName,
        price: rental.price,
        image: rental.image,
        tradeMethod: rental.tradeMethod,
      };
      navigate('/chat', { state: { product } });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/mypage')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">대여 내역</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-8">
        {rentals.length > 0 ? (
          <div className="space-y-4">
            {rentals.map((rental) => (
              <div
                key={rental.id}
                onClick={() => handleRentalClick(rental)}
                className={`bg-white rounded-xl p-4 shadow-sm ${
                  rental.tradeMethod === '직거래'
                    ? 'cursor-pointer hover:shadow-md transition-shadow'
                    : ''
                }`}
              >
                <div className="flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {rental.image && (
                      <img
                        src={rental.image}
                        alt={rental.productName}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg mb-1">{rental.productName}</h3>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          rental.tradeMethod === '픽업존'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {rental.tradeMethod}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${getStatusColor(rental.status)} whitespace-nowrap ml-2`}>
                        {rental.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">대여 기간: {rental.rentalDate}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-purple-600">{rental.price}</p>
                      {rental.tradeMethod === '직거래' && (
                        <span className="text-xs text-gray-500">클릭하여 채팅 보기</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">대여 내역이 없습니다.</p>
            <p className="text-gray-300 text-sm mt-2">상품을 대여해보세요!</p>
          </div>
        )}
      </div>
    </div>
  );
}

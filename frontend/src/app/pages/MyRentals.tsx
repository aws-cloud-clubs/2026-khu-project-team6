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
  rentalEnd: string | null;
  daysLeft: number | null;
  status: string;
  tradeMethod: string;
  role: string;
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
      case '거래 완료':
        return 'text-green-600';
      case '확정':
        return 'text-blue-600';
      case '요청 중':
        return 'text-yellow-600';
      case '반납 완료':
        return 'text-green-700';
      case '취소됨':
        return 'text-red-500';
      case '연체 중':
        return 'text-red-600';
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
    // 픽업존 대여는 상세 정보만 확인 (채팅 없음)
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
                className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
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
                    {rental.daysLeft !== null && rental.status !== '거래 완료' && rental.status !== '취소됨' && (
                      <p className={`text-xs font-medium mb-1 ${
                        rental.daysLeft < 0 ? 'text-red-600' :
                        rental.daysLeft <= 1 ? 'text-orange-500' :
                        rental.daysLeft <= 3 ? 'text-yellow-600' :
                        'text-gray-500'
                      }`}>
                        {rental.daysLeft < 0
                          ? `⚠️ ${Math.abs(rental.daysLeft)}일 연체 중`
                          : rental.daysLeft === 0
                          ? '⏰ 오늘 반납 마감'
                          : `📅 반납까지 ${rental.daysLeft}일 남음`}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-purple-600">{rental.price}</p>
                      <span className="text-xs text-gray-500">
                        {rental.role === 'buyer' ? '구매' : '판매'}
                      </span>
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

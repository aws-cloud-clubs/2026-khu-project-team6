import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

export default function MyRentals() {
  const navigate = useNavigate();

  // 대여 내역 샘플 데이터
  const rentals = [
    {
      id: 1,
      productName: '디지털 카메라',
      image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400',
      price: '150,000원',
      rentalDate: '2024.01.15 - 2024.01.17',
      status: '반납 완료',
      statusColor: 'text-gray-600',
      tradeMethod: '픽업존',
    },
    {
      id: 2,
      productName: '캠핑 텐트 4인용',
      image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400',
      price: '180,000원',
      rentalDate: '2024.01.20 - 2024.01.22',
      status: '대여 중',
      statusColor: 'text-purple-600',
      tradeMethod: '직거래',
    },
    {
      id: 3,
      productName: '고프로 히어로 11',
      image: 'https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400',
      price: '120,000원',
      rentalDate: '2024.01.10 - 2024.01.12',
      status: '반납 완료',
      statusColor: 'text-gray-600',
      tradeMethod: '픽업존',
    },
  ];

  const handleRentalClick = (rental: any) => {
    // 직거래 상품만 채팅 페이지로 이동
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
    // 픽업존 상품은 아무 동작 안함
  };

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
                  <img
                    src={rental.image}
                    alt={rental.productName}
                    className="w-full h-full object-cover"
                  />
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
                    <span className={`text-sm font-medium ${rental.statusColor} whitespace-nowrap ml-2`}>
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

        {rentals.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400">대여 내역이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

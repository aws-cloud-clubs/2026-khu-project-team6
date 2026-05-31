import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export default function Rental() {
  const navigate = useNavigate();
  const location = useLocation();
  const itemTitle = location.state?.itemTitle || '상품';

  // 대여 상품 데이터
  const rentalProducts = [
    // 콘서트
    { id: 1, title: '아이폰 15 Pro Max (울트라)', price: '15,000원', image: 'https://images.unsplash.com/photo-1592286927505-b0e2c0e1f53f?w=400', tradeMethod: '픽업존' },
    { id: 2, title: '캐논 망원렌즈 (대포카메라)', price: '35,000원', image: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400', tradeMethod: '직거래' },
    { id: 3, title: '공식 응원봉', price: '8,000원', image: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400', tradeMethod: '픽업존' },
    { id: 4, title: '휴대용 미니 선풍기', price: '3,000원', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400', tradeMethod: '직거래' },
    { id: 5, title: '대용량 보조배터리 20000mAh', price: '5,000원', image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400', tradeMethod: '픽업존' },
    { id: 6, title: '고배율 쌍안경', price: '12,000원', image: 'https://images.unsplash.com/photo-1591696331111-ef9586a5b17a?w=400', tradeMethod: '직거래' },
    // 졸업사진
    { id: 7, title: '학사모 + 졸업가운 세트', price: '20,000원', image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400', tradeMethod: '픽업존' },
    { id: 8, title: '프리미엄 꽃다발', price: '15,000원', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400', tradeMethod: '직거래' },
    { id: 9, title: '정장 (남성용)', price: '25,000원', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400', tradeMethod: '픽업존' },
    { id: 10, title: '구두 (여성용)', price: '10,000원', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400', tradeMethod: '직거래' },
    // 여행
    { id: 11, title: '멀티 어댑터 (돼지코)', price: '3,000원', image: 'https://images.unsplash.com/photo-1591123120675-6f7f1aae0e5b?w=400', tradeMethod: '픽업존' },
    { id: 12, title: '대형 캐리어 28인치', price: '15,000원', image: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=400', tradeMethod: '직거래' },
    { id: 13, title: '소니 디지털 카메라', price: '30,000원', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', tradeMethod: '픽업존' },
    { id: 14, title: '고프로 히어로 11', price: '25,000원', image: 'https://images.unsplash.com/photo-1585909695284-32d2985ac9c0?w=400', tradeMethod: '직거래' },
    { id: 15, title: '포켓 와이파이 (에그)', price: '8,000원', image: 'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400', tradeMethod: '픽업존' },
    // 캠핑
    { id: 16, title: '4인용 텐트', price: '30,000원', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400', tradeMethod: '픽업존' },
    { id: 17, title: '캠핑 타프', price: '15,000원', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400', tradeMethod: '직거래' },
    { id: 18, title: '침낭 + 매트 세트', price: '12,000원', image: 'https://images.unsplash.com/photo-1487730116645-74489c95b41b?w=400', tradeMethod: '픽업존' },
    { id: 19, title: '캠핑 코펠 + 버너 세트', price: '10,000원', image: 'https://images.unsplash.com/photo-1517003438589-decc2cd9d355?w=400', tradeMethod: '직거래' },
    { id: 20, title: '접이식 캠핑 테이블', price: '8,000원', image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=400', tradeMethod: '픽업존' },
    // 결혼식
    { id: 21, title: '남성 하객룩 (정장)', price: '30,000원', image: 'https://images.unsplash.com/photo-1594938291221-94f18cbb5660?w=400', tradeMethod: '픽업존' },
    { id: 22, title: '여성 하객룩 (드레스)', price: '35,000원', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400', tradeMethod: '직거래' },
    { id: 23, title: '남성 구두 (블랙)', price: '10,000원', image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400', tradeMethod: '픽업존' },
    { id: 24, title: '실크 넥타이', price: '5,000원', image: 'https://images.unsplash.com/photo-1589756823695-278bc8356dd6?w=400', tradeMethod: '직거래' },
    // 면접
    { id: 25, title: '남성 면접 정장 세트', price: '25,000원', image: 'https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=400', tradeMethod: '픽업존' },
    { id: 26, title: '여성 면접 정장 세트', price: '25,000원', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400', tradeMethod: '직거래' },
    { id: 27, title: '남성 구두 (브라운)', price: '10,000원', image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=400', tradeMethod: '픽업존' },
    { id: 28, title: '여성 구두 (블랙)', price: '10,000원', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400', tradeMethod: '직거래' },
    // 페스티벌
    { id: 29, title: '페스티벌 의상 (유니크)', price: '20,000원', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400', tradeMethod: '픽업존' },
    { id: 30, title: '방수 힙색', price: '8,000원', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', tradeMethod: '직거래' },
    { id: 31, title: '브랜드 선글라스', price: '12,000원', image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400', tradeMethod: '픽업존' },
    { id: 32, title: '방수팩', price: '5,000원', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400', tradeMethod: '직거래' },
  ];

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
        </div>
      </div>
    </div>
  );
}

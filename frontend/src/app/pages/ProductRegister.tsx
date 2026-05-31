import { ArrowLeft, Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';

export default function ProductRegister() {
  const navigate = useNavigate();
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [tradeMethod, setTradeMethod] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardVerified, setCardVerified] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    '콘서트',
    '졸업사진',
    '여행',
    '캠핑',
    '결혼식',
    '면접',
    '페스티벌',
  ];

  const subCategories: { [key: string]: string[] } = {
    '콘서트': ['울트라 핸드폰', '대포카메라', '응원봉', '손풍기', '보조배터리', '쌍안경', '돗자리', '기타'],
    '졸업사진': ['학사모', '졸업가운', '꽃다발', '정장', '구두', '기타'],
    '여행': ['돼지코', '캐리어', '디카', '보조배터리', '고프로', '여행용 와이파이(에그)', '기타'],
    '캠핑': ['텐트', '타프', '쉘터', '침구', '계절용품', '조리도구(화로, 코펠, 버너 등)', '식기', '의자', '테이블', '가구', '타포(그늘막)', '수레', '기타'],
    '결혼식': ['하객룩', '구두', '넥타이', '기타'],
    '면접': ['면접룩', '구두', '기타'],
    '페스티벌': ['의상', '방수팩', '선글라스', '기타'],
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setSubCategory(''); // 카테고리 변경 시 세부 항목 초기화
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB를 초과할 수 없습니다.');
      return;
    }

    // 이미지 파일인지 체크
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
    if (value.length <= 16) {
      // 4자리마다 하이픈 추가
      const formatted = value.match(/.{1,4}/g)?.join('-') || value;
      setCardNumber(formatted);
    }
  };

  const handleCardVerification = () => {
    const cleanCardNumber = cardNumber.replace(/-/g, '');
    if (cleanCardNumber.length !== 16) {
      alert('카드 번호 16자리를 입력해주세요.');
      return;
    }

    // 실제로는 PG사 API를 통해 카드 인증을 진행
    // 현재는 목업으로 처리
    alert('카드 인증이 완료되었습니다.');
    setCardVerified(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !category || !subCategory || !price || !description || !tradeMethod) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    if (!imagePreview) {
      alert('상품 이미지를 업로드해주세요.');
      return;
    }
    if (!cardVerified) {
      alert('카드 인증을 완료해주세요.');
      return;
    }
    alert('상품이 등록되었습니다!');
    navigate('/mypage');
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
          <h1 className="text-xl font-bold">상품 등록</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          {/* Image Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 이미지
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="상품 미리보기"
                  className="w-full h-64 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            ) : (
              <div
                onClick={handleUploadClick}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-300 transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">이미지를 업로드하세요</p>
                <p className="text-xs text-gray-400 mt-1">최대 5MB</p>
              </div>
            )}
          </div>

          {/* Product Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품명
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="상품명을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          {/* Category */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            >
              <option value="">카테고리를 선택하세요</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sub Category */}
          {category && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                세부 항목
              </label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                required
              >
                <option value="">세부 항목을 선택하세요</option>
                {subCategories[category]?.map((subCat) => (
                  <option key={subCat} value={subCat}>
                    {subCat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Price */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대여 가격 (1일 기준)
            </label>
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 50,000원"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          {/* Trade Method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              거래 방식
            </label>
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="tradeMethod"
                  value="픽업존"
                  checked={tradeMethod === '픽업존'}
                  onChange={(e) => setTradeMethod(e.target.value)}
                  className="sr-only"
                  required
                />
                <div className={`px-4 py-3 border-2 rounded-xl text-center transition-colors ${
                  tradeMethod === '픽업존'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}>
                  픽업존
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="tradeMethod"
                  value="직거래"
                  checked={tradeMethod === '직거래'}
                  onChange={(e) => setTradeMethod(e.target.value)}
                  className="sr-only"
                  required
                />
                <div className={`px-4 py-3 border-2 rounded-xl text-center transition-colors ${
                  tradeMethod === '직거래'
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}>
                  직거래
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상품 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상품에 대한 상세 설명을 입력하세요"
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400 resize-none"
              required
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Card Verification */}
          <div className="mb-6">
            <h2 className="text-lg font-bold mb-4">판매자 인증</h2>
            <p className="text-sm text-gray-600 mb-4">안전한 거래를 위해 카드 인증이 필요합니다.</p>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              카드 번호
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={cardNumber}
                onChange={handleCardNumberChange}
                placeholder="0000-0000-0000-0000"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
                disabled={cardVerified}
                required
              />
              <button
                type="button"
                onClick={handleCardVerification}
                disabled={cardVerified}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  cardVerified
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {cardVerified ? '인증완료' : '인증하기'}
              </button>
            </div>
            {cardVerified && (
              <p className="text-sm text-green-600 mt-2">✓ 카드 인증이 완료되었습니다.</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors"
          >
            등록하기
          </button>
        </form>
      </div>
    </div>
  );
}

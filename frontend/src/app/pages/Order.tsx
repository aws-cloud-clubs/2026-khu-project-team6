import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import apiClient from '../../api/client';

export default function Order() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || {};

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bank, setBank] = useState('');
  const [rentalDays, setRentalDays] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !address || !accountHolder || !accountNumber || !bank || !rentalDays) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    try {
      // rentals 테이블에 INSERT
      const today = new Date();
      const rentalStart = today.toISOString().split('T')[0];
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + Number(rentalDays));
      const rentalEnd = endDate.toISOString().split('T')[0];

      await apiClient.post('/rentals', {
        item_id: product.id,
        seller_id: product.seller_id,
        rental_start: rentalStart,
        rental_end: rentalEnd,
      });

      alert('대여 신청이 완료되었습니다!');
      navigate('/my-rentals');
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: { message?: string } } } };
      alert('대여 신청 실패: ' + (e2?.response?.data?.error?.message || '서버 오류'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold flex-1">대여 신청</h1>
          <button
            onClick={() => navigate('/admin-chat', { state: { product } })}
            className="text-gray-600 hover:text-purple-600 transition-colors"
            title="관리자에게 문의하기"
          >
            <HelpCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-8">
        {/* Product Info */}
        <div
          className="bg-white rounded-xl p-4 mb-6 shadow-sm cursor-default select-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex gap-4 pointer-events-none">
            <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">{product.title}</h3>
              <p className="text-purple-600 font-bold">{product.price}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          {/* Delivery Info */}
          <h2 className="text-lg font-bold mb-4">배송 정보</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              받는 사람
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              연락처
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              주소
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="주소를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400 mb-2"
              required
            />
            <input
              type="text"
              value={detailAddress}
              onChange={(e) => setDetailAddress(e.target.value)}
              placeholder="상세 주소를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Rental Period */}
          <h2 className="text-lg font-bold mb-4">대여 기간</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대여 일수
            </label>
            <select
              value={rentalDays}
              onChange={(e) => setRentalDays(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            >
              <option value="">대여 기간을 선택하세요</option>
              <option value="1">1일</option>
              <option value="2">2일</option>
              <option value="3">3일</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">※ 상품 출고일로부터 선택하신 일수만큼 대여됩니다.</p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Payment Info */}
          <h2 className="text-lg font-bold mb-4">결제 정보</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              은행
            </label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            >
              <option value="">은행을 선택하세요</option>
              <option value="국민은행">국민은행</option>
              <option value="신한은행">신한은행</option>
              <option value="우리은행">우리은행</option>
              <option value="하나은행">하나은행</option>
              <option value="NH농협">NH농협</option>
              <option value="카카오뱅크">카카오뱅크</option>
              <option value="토스뱅크">토스뱅크</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              예금주
            </label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="예금주를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              계좌번호
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="- 없이 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors"
          >
            대여 신청하기
          </button>
        </form>
      </div>
    </div>
  );
}

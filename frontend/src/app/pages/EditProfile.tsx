import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function EditProfile() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    setName(localStorage.getItem('userName') || '');
    setNickname(localStorage.getItem('userNickname') || '');
    setEmail(localStorage.getItem('userEmail') || '');
    setPhone(localStorage.getItem('userPhone') || '');
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    // 정보 업데이트
    localStorage.setItem('userName', name);
    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('userEmail', email);
    if (phone) {
      localStorage.setItem('userPhone', phone);
    }

    alert('회원정보가 수정되었습니다!');
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
          <h1 className="text-xl font-bold">회원정보 수정</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm">
          {/* Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름
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

          {/* Nickname */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              닉네임
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          {/* Email */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              required
            />
          </div>

          {/* Phone */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              전화번호
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* Password Change Section */}
          <h3 className="text-lg font-bold mb-4">비밀번호 변경</h3>
          <p className="text-xs text-gray-500 mb-4">비밀번호를 변경하지 않으려면 비워두세요.</p>

          {/* Current Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* New Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
              minLength={8}
            />
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호를 다시 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors"
          >
            저장하기
          </button>
        </form>
      </div>
    </div>
  );
}

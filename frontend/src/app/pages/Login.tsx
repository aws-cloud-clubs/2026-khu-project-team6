import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import type { AxiosError } from 'axios';
import type { ApiError } from '../../api/client';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const code = axiosErr.response?.data?.error?.code;
      if (code === 'ACCOUNT_LOCKED') {
        setErrorMsg('계정이 잠겼습니다. 15분 후 다시 시도해주세요.');
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        setErrorMsg('이메일 인증을 완료해주세요.');
      } else {
        setErrorMsg('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="text-xl font-bold text-gray-900">HARUMAN</div>
          <div className="text-[10px] text-gray-500">Buy Less, Experience More</div>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-xl mb-6">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">새로운 바이럴,</h1>
          <h2 className="text-3xl font-bold mb-3">하루만 해보자</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소를 입력하세요."
              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요."
              className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              required
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-red-500 text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-xl font-medium transition-colors"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <span className="text-sm text-gray-600">계정이 없으신가요? </span>
          <button
            onClick={() => navigate('/signup')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}

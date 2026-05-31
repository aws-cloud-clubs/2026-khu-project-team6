/**
 * Step 1: 이메일 인증 요청 페이지
 * 이메일 입력 → signUp(임시 비밀번호) → 인증 메일 발송
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendVerification = async () => {
    if (!email || !email.includes('@')) {
      setErrorMsg('올바른 이메일 주소를 입력하세요.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    // 임시 랜덤 비밀번호 생성 (Step 2에서 진짜 비밀번호로 덮어씀)
    const tempPassword = crypto.randomUUID() + '!Aa1';

    const { error } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        // 인증 링크 클릭 후 돌아올 URL
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      if (error.message.includes('already') || error.message.includes('registered')) {
        setErrorMsg('이미 가입된 이메일입니다. 로그인해주세요.');
      } else {
        setErrorMsg('인증 메일 발송 실패: ' + error.message);
      }
      setIsSending(false);
      return;
    }

    setIsEmailSent(true);
    setIsSending(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-8">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="text-xl font-bold text-gray-900">HARUMAN</div>
          <div className="text-[10px] text-gray-500">Buy Less, Experience More</div>
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 rounded-xl mb-6">
            <span className="text-white text-2xl font-bold">H</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">회원가입</h1>
          <p className="text-gray-500 text-sm">이메일 인증 후 가입이 완료됩니다.</p>
        </div>

        {!isEmailSent ? (
          /* ─── 이메일 입력 폼 ─── */
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일 (아이디)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소를 입력하세요."
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleSendVerification()}
              />
              <p className="text-xs text-gray-500 mt-1">이 이메일이 로그인 아이디로 사용됩니다.</p>
            </div>

            {errorMsg && <p className="text-sm text-red-500 text-center">{errorMsg}</p>}

            <button
              onClick={handleSendVerification}
              disabled={isSending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-xl font-medium transition-colors"
            >
              {isSending ? '발송 중...' : '인증메일 전송'}
            </button>
          </div>
        ) : (
          /* ─── 인증 대기 안내 ─── */
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
              <span className="text-4xl">📧</span>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">메일함을 확인해 주세요</h2>
              <p className="text-gray-600 text-sm">
                <strong>{email}</strong>로 인증 링크를 발송했습니다.
              </p>
              <p className="text-gray-500 text-xs mt-2">
                메일의 링크를 클릭하면 자동으로 다음 단계로 이동합니다.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500">
                메일이 오지 않나요? 스팸함을 확인하거나, 잠시 후 다시 시도해주세요.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <span className="text-sm text-gray-600">이미 계정이 있으신가요? </span>
          <button onClick={() => navigate('/login')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}

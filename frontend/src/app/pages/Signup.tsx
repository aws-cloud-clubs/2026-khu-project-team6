import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { checkDuplicate } from '../../api/auth';
import apiClient from '../../api/client';

type DuplicateState = 'idle' | 'checking' | 'available' | 'taken';

/**
 * 2단계 회원가입 플로우 (Resend 기반)
 * Step 1: 이메일 입력 → 백엔드 /auth/send-verification → Resend로 인증 메일 발송 → 링크 클릭 대기
 * Step 2: 인증 완료 감지 → 나머지 정보 입력 → 백엔드 /auth/register 호출
 */
export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ─── Step 상태 ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ─── Step 1: 이메일 인증 ───────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // ─── Step 2: 나머지 정보 ───────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameDup, setNicknameDup] = useState<DuplicateState>('idle');
  const [phone, setPhone] = useState('');
  const [phoneDup, setPhoneDup] = useState<DuplicateState>('idle');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeService, setAgreeService] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeDeposit, setAgreeDeposit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounceCheck = useCallback(
    (field: 'nickname' | 'phone', value: string, setter: (s: DuplicateState) => void) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) { setter('idle'); return; }
      setter('checking');
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await checkDuplicate(field, value);
          setter(res.available ? 'available' : 'taken');
        } catch {
          setter('idle');
        }
      }, 500);
    },
    [],
  );

  // ─── URL 파라미터로 인증 완료 감지 (이메일 링크 클릭 후 리다이렉트) ────────
  useEffect(() => {
    const verified = searchParams.get('verified');
    const verifiedEmail = searchParams.get('email');
    if (verified === 'true' && verifiedEmail) {
      setEmail(decodeURIComponent(verifiedEmail));
      setIsEmailVerified(true);
      setIsEmailSent(true);
      setStep(2);
    }
  }, [searchParams]);

  // ─── 이메일 인증 상태 폴링 (메일 전송 후) ─────────────────────────────────
  useEffect(() => {
    if (!isEmailSent || isEmailVerified) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiClient.post('/auth/verify-email-status', { email });
        if (res.data.verified) {
          setIsEmailVerified(true);
          setStep(2);
          clearInterval(interval);
        }
      } catch { /* 무시 */ }
    }, 3000); // 3초마다 확인

    return () => clearInterval(interval);
  }, [isEmailSent, isEmailVerified, email]);

  // ─── Step 1: 인증메일 전송 (백엔드 → Resend) ──────────────────────────────
  const handleSendVerification = async () => {
    if (!email || !email.includes('@')) {
      setErrorMsg('올바른 이메일 주소를 입력하세요.');
      return;
    }

    setIsSending(true);
    setErrorMsg('');

    try {
      await apiClient.post('/auth/send-verification', { email });
      setIsEmailSent(true);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || '인증 메일 발송 실패';
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  // ─── Step 2: 가입 완료 (백엔드 /auth/register) ────────────────────────────
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isEmailVerified) {
      setErrorMsg('이메일 인증을 먼저 완료해주세요.');
      return;
    }
    if (password.length < 8) { setErrorMsg('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (password !== confirmPassword) { setErrorMsg('비밀번호가 일치하지 않습니다.'); return; }
    if (!agreeService || !agreePrivacy || !agreeDeposit) {
      setErrorMsg('필수 약관에 모두 동의해주세요.');
      return;
    }
    if (nicknameDup === 'taken' || phoneDup === 'taken') {
      setErrorMsg('중복된 정보가 있습니다. 확인해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/register', {
        email,
        password,
        real_name: name,
        nickname,
        phone,
      });

      setSuccessMsg('회원가입이 완료되었습니다!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || '회원가입에 실패했습니다.';
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  // ─── 중복 체크 라벨 ────────────────────────────────────────────────────────
  const dupLabel = (state: DuplicateState) => {
    if (state === 'checking') return <span className="text-xs text-gray-400">확인 중...</span>;
    if (state === 'available') return <span className="text-xs text-green-600">사용 가능합니다.</span>;
    if (state === 'taken') return <span className="text-xs text-red-500">이미 사용 중입니다.</span>;
    return null;
  };

  // ─── 성공 화면 ─────────────────────────────────────────────────────────────
  if (successMsg) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold mb-4">{successMsg}</h1>
          <p className="text-gray-500 text-sm">잠시 후 로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  // ─── 메인 렌더링 ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
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
          <h1 className="text-3xl font-bold mb-2">새로운 바이럴,</h1>
          <h2 className="text-3xl font-bold mb-3">하루만 해보자</h2>
        </div>

        {/* ═══════════════ Step 1: 이메일 인증 ═══════════════ */}
        <div className={`space-y-5 ${step === 2 ? 'opacity-50 pointer-events-none' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일 (아이디)
              {isEmailVerified && <span className="ml-2 text-green-600 text-xs">✓ 인증완료</span>}
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 주소를 입력하세요."
                className="flex-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required
                disabled={isEmailSent || isEmailVerified}
              />
              <button
                type="button"
                onClick={handleSendVerification}
                disabled={isSending || isEmailSent || isEmailVerified}
                className="px-4 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isEmailVerified ? '✓ 인증완료' : isSending ? '발송 중...' : '인증메일 전송'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">이메일이 로그인 아이디로 사용됩니다.</p>
          </div>

          {/* 인증 대기 안내 */}
          {isEmailSent && !isEmailVerified && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-700">
                📧 <strong>{email}</strong>로 인증 링크를 발송했습니다.
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                메일함에서 링크를 클릭하면 자동으로 다음 단계로 넘어갑니다.
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════ Step 2: 나머지 정보 입력 ═══════════════ */}
        {step === 2 && (
          <form onSubmit={handleCompleteSignup} className="space-y-5 mt-6 pt-6 border-t border-gray-200">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-green-700">✅ 이메일 인증 완료! 나머지 정보를 입력해주세요.</p>
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요."
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required />
            </div>

            {/* 닉네임 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">닉네임</label>
              <input type="text" value={nickname}
                onChange={(e) => { setNickname(e.target.value); debounceCheck('nickname', e.target.value, setNicknameDup); }}
                placeholder="닉네임을 입력하세요."
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required />
              {dupLabel(nicknameDup)}
            </div>

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
              <input type="tel" value={phone}
                onChange={(e) => { setPhone(e.target.value); debounceCheck('phone', e.target.value, setPhoneDup); }}
                placeholder="010-0000-0000"
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required />
              {dupLabel(phoneDup)}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요." minLength={8}
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required />
              <p className="text-xs text-gray-500 mt-1">8자 이상 입력하세요.</p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호 확인</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호를 다시 입력하세요."
                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-gray-700">필수 약관 동의</p>
              {[
                { label: '서비스 이용약관 동의 (필수)', value: agreeService, setter: setAgreeService },
                { label: '개인정보처리방침 동의 (필수)', value: agreePrivacy, setter: setAgreePrivacy },
                { label: '보증금 차감 정책 동의 (필수)', value: agreeDeposit, setter: setAgreeDeposit },
              ].map(({ label, value, setter }) => (
                <label key={label} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            {errorMsg && <p className="text-sm text-red-500 text-center">{errorMsg}</p>}

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-xl font-medium transition-colors">
              {isSubmitting ? '가입 완료 중...' : '가입 완료'}
            </button>
          </form>
        )}

        {/* Step 1에서 에러 표시 */}
        {step === 1 && errorMsg && <p className="text-sm text-red-500 text-center mt-4">{errorMsg}</p>}

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

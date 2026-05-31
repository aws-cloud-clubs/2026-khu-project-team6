import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { register, checkDuplicate, resendVerification } from '../../api/auth';
import type { AxiosError } from 'axios';
import type { ApiError } from '../../api/client';

type DuplicateState = 'idle' | 'checking' | 'available' | 'taken';

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameDup, setNicknameDup] = useState<DuplicateState>('idle');
  const [phone, setPhone] = useState('');
  const [phoneDup, setPhoneDup] = useState<DuplicateState>('idle');
  const [email, setEmail] = useState('');
  const [emailDup, setEmailDup] = useState<DuplicateState>('idle');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [agreeService, setAgreeService] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeDeposit, setAgreeDeposit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 500ms debounce 타이머
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounceCheck = useCallback(
    (field: 'email' | 'nickname' | 'phone', value: string, setter: (s: DuplicateState) => void) => {
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

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) { setErrorMsg('올바른 이메일 주소를 입력하세요.'); return; }
    try {
      await resendVerification(email);
      setIsCodeSent(true);
      setErrorMsg('');
    } catch {
      setErrorMsg('인증 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleVerifyCode = async () => {
    // 실제 토큰 검증은 백엔드에서 처리
    // 여기서는 6자리 입력 여부만 확인하고 verify-email API 호출
    if (verificationCode.length !== 6) { setErrorMsg('인증번호 6자리를 입력하세요.'); return; }
    try {
      const { verifyEmail } = await import('../../api/auth');
      await verifyEmail(verificationCode);
      setIsVerified(true);
      setErrorMsg('');
    } catch {
      setErrorMsg('인증번호가 올바르지 않습니다.');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isVerified) { setErrorMsg('이메일 인증을 완료해주세요.'); return; }
    if (password !== confirmPassword) { setErrorMsg('비밀번호가 일치하지 않습니다.'); return; }
    if (!agreeService || !agreePrivacy || !agreeDeposit) {
      setErrorMsg('필수 약관에 모두 동의해주세요.');
      return;
    }
    if (emailDup === 'taken' || nicknameDup === 'taken' || phoneDup === 'taken') {
      setErrorMsg('중복된 정보가 있습니다. 확인해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        real_name: name,
        email,
        phone,
        nickname,
        password,
        agreements: { service: agreeService, privacy: agreePrivacy, deposit: agreeDeposit },
      });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      setErrorMsg(axiosErr.response?.data?.error?.message ?? '회원가입에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dupLabel = (state: DuplicateState) => {
    if (state === 'checking') return <span className="text-xs text-gray-400">확인 중...</span>;
    if (state === 'available') return <span className="text-xs text-green-600">사용 가능합니다.</span>;
    if (state === 'taken') return <span className="text-xs text-red-500">이미 사용 중입니다.</span>;
    return null;
  };

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

        <form onSubmit={handleSignup} className="space-y-5">
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

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">이메일 (아이디)</label>
            <div className="flex gap-2">
              <input type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); debounceCheck('email', e.target.value, setEmailDup); }}
                placeholder="이메일 주소를 입력하세요."
                className="flex-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                required disabled={isVerified} />
              <button type="button" onClick={handleSendCode} disabled={isVerified}
                className="px-4 py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap">
                {isVerified ? '인증완료' : isCodeSent ? '재전송' : '인증번호 받기'}
              </button>
            </div>
            {dupLabel(emailDup)}
            <p className="text-xs text-gray-500 mt-1">이메일이 로그인 아이디로 사용됩니다.</p>
          </div>

          {/* 인증번호 */}
          {isCodeSent && !isVerified && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">인증번호</label>
              <div className="flex gap-2">
                <input type="text" value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="인증번호 6자리" maxLength={6}
                  className="flex-1 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-white transition-colors" />
                <button type="button" onClick={handleVerifyCode}
                  className="px-4 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors whitespace-nowrap">
                  인증확인
                </button>
              </div>
            </div>
          )}

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
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-4 rounded-xl font-medium transition-colors mt-6">
            {isSubmitting ? '가입 중...' : '가입하기'}
          </button>
        </form>

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

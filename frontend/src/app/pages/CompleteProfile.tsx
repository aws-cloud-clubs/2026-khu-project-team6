/**
 * Step 2: 추가 정보 입력 페이지
 * 이메일 인증 완료 후 이름/닉네임/전화번호/진짜 비밀번호를 설정
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { checkDuplicate } from '../../api/auth';

type DuplicateState = 'idle' | 'checking' | 'available' | 'taken';

export default function CompleteProfile() {
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState('');
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── 세션 확인: 인증된 유저가 아니면 /signup으로 리다이렉트 ─────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !session.user.email_confirmed_at) {
        // 인증 안 된 유저 → 회원가입 페이지로
        navigate('/signup', { replace: true });
        return;
      }
      // 이미 프로필 완성된 유저 → 홈으로
      if (session.user.user_metadata?.nickname) {
        navigate('/', { replace: true });
        return;
      }
      setUserEmail(session.user.email || '');
    });
  }, [navigate]);

  // ─── 중복 체크 debounce ────────────────────────────────────────────────────
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

  // ─── 가입 완료: updateUser ─────────────────────────────────────────────────
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) { setErrorMsg('이름을 입력해주세요.'); return; }
    if (!nickname.trim()) { setErrorMsg('닉네임을 입력해주세요.'); return; }
    if (!phone.trim()) { setErrorMsg('전화번호를 입력해주세요.'); return; }
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

    // 진짜 비밀번호 + user_metadata 업데이트
    const { error } = await supabase.auth.updateUser({
      password,
      data: {
        real_name: name,
        nickname,
        phone,
      },
    });

    if (error) {
      setErrorMsg('가입 완료 실패: ' + error.message);
      setIsSubmitting(false);
      return;
    }

    // 완료 후 로그아웃 → 로그인 페이지로 (깨끗한 상태에서 진짜 비밀번호로 로그인)
    await supabase.auth.signOut();
    navigate('/login', { state: { registered: true } });
  };

  // ─── 중복 라벨 ────────────────────────────────────────────────────────────
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-xl mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">이메일 인증 완료!</h1>
          <p className="text-gray-500 text-sm">
            <strong>{userEmail}</strong> 인증이 확인되었습니다.<br />
            나머지 정보를 입력하고 가입을 완료하세요.
          </p>
        </div>

        <form onSubmit={handleComplete} className="space-y-5">
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
              placeholder="사용할 비밀번호를 입력하세요." minLength={8}
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
      </div>
    </div>
  );
}

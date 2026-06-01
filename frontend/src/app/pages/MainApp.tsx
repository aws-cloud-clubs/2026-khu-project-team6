import { Search, Heart, Menu, Send, ChevronRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { sendAIChat } from '../../api/ai';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { sendAIChat } from '../../api/ai';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  suggestedItemTypes?: string[];
}

export default function MainApp() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [chatInput, setChat] = useState('');
  const [chatMessages, setChatMessages] = useState<
  { sender: 'user' | 'ai'; text: string }[]
>([
  {
    sender: 'ai',
    text: '필요한 물품을 추천받아 보세요!'
  }
]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});
  const [activeCategory, setActiveCategory] = useState('콘서트');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatIdRef = useRef(0);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      alert('로그인이 필요합니다.');
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const categories = [
    { icon: '🎤', label: '콘서트' },
    { icon: '🎓', label: '졸업사진' },
    { icon: '✈️', label: '여행' },
    { icon: '🏕️', label: '캠핑' },
    { icon: '💍', label: '결혼식' },
    { icon: '💼', label: '면접' },
    { icon: '🏖️', label: '페스티벌' },
  ];

  const checklistData: { [key: string]: Array<{ id: number; title: string; category: string }> } = {
    '콘서트': [
      { id: 1, title: '울트라 핸드폰', category: '전자기기' },
      { id: 2, title: '대포카메라', category: '촬영장비' },
      { id: 3, title: '응원봉', category: '응원용품' },
      { id: 4, title: '손풍기', category: '편의용품' },
      { id: 5, title: '보조배터리', category: '전자기기' },
      { id: 6, title: '쌍안경', category: '광학장비' },
      { id: 7, title: '돗자리', category: '편의용품' },
      { id: 8, title: '기타', category: '기타' },
    ],
    '졸업사진': [
      { id: 9, title: '학사모', category: '졸업용품' },
      { id: 10, title: '졸업가운', category: '졸업용품' },
      { id: 11, title: '꽃다발', category: '기념품' },
      { id: 12, title: '정장', category: '의류' },
      { id: 13, title: '구두', category: '신발' },
      { id: 14, title: '기타', category: '기타' },
    ],
    '여행': [
      { id: 15, title: '돼지코', category: '전자기기' },
      { id: 16, title: '캐리어', category: '수납용품' },
      { id: 17, title: '디카', category: '촬영장비' },
      { id: 18, title: '보조배터리', category: '전자기기' },
      { id: 19, title: '고프로', category: '촬영장비' },
      { id: 20, title: '여행용 와이파이(에그)', category: '통신장비' },
      { id: 21, title: '기타', category: '기타' },
    ],
    '캠핑': [
      { id: 22, title: '텐트', category: '숙박용품' },
      { id: 23, title: '타프', category: '차양용품' },
      { id: 24, title: '쉘터', category: '숙박용품' },
      { id: 25, title: '침구', category: '침구류' },
      { id: 26, title: '계절용품', category: '기타' },
      { id: 27, title: '조리도구(화로, 코펠, 버너 등)', category: '조리용품' },
      { id: 28, title: '식기', category: '식사용품' },
      { id: 29, title: '의자', category: '가구' },
      { id: 30, title: '테이블', category: '가구' },
      { id: 31, title: '가구', category: '가구' },
      { id: 32, title: '타포(그늘막)', category: '차양용품' },
      { id: 33, title: '수레', category: '운반용품' },
      { id: 34, title: '기타', category: '기타' },
    ],
    '결혼식': [
      { id: 35, title: '하객룩', category: '의류' },
      { id: 36, title: '구두', category: '신발' },
      { id: 37, title: '넥타이', category: '액세서리' },
      { id: 38, title: '기타', category: '기타' },
    ],
    '면접': [
      { id: 39, title: '면접룩', category: '의류' },
      { id: 40, title: '구두', category: '신발' },
      { id: 41, title: '기타', category: '기타' },
    ],
    '페스티벌': [
      { id: 42, title: '의상', category: '의류' },
      { id: 43, title: '방수팩', category: '보호용품' },
      { id: 44, title: '선글라스', category: '액세서리' },
      { id: 45, title: '기타', category: '기타' },
    ],
  };

  const currentChecklistItems = checklistData[activeCategory] || [];

  const toggleCheck = (id: number) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // AI 응답의 suggestedItemTypes로 체크박스 자동 선택 (Requirements: 5.4, 16.3)
  const autoCheckFromAI = (suggestedItemTypes: string[]) => {
    if (suggestedItemTypes.length === 0) return;

    // 모든 카테고리의 아이템에서 매칭
    const allItems = Object.values(checklistData).flat();
    const newChecked: { [key: number]: boolean } = { ...checkedItems };

    suggestedItemTypes.forEach((typeName) => {
      const matchedItem = allItems.find(
        (item) => item.title === typeName || item.title.includes(typeName)
      );
      if (matchedItem) {
        newChecked[matchedItem.id] = true;
      }
    });

    setCheckedItems(newChecked);
  };

  // AI 챗봇 메시지 전송
  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isChatLoading) return;

    if (trimmed.length > 500) {
      setChatError('메시지는 500자를 초과할 수 없습니다.');
      return;
    }

    setChatError(null);
    const userMsg: ChatMessage = {
      id: ++chatIdRef.current,
      text: trimmed,
      sender: 'user',
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChat('');
    setIsChatLoading(true);

    try {
      const response = await sendAIChat(trimmed);
      const aiMsg: ChatMessage = {
        id: ++chatIdRef.current,
        text: response.reply,
        sender: 'ai',
        suggestedItemTypes: response.suggestedItemTypes,
      };
      setChatMessages(prev => [...prev, aiMsg]);

      // 2초 이내 체크박스 자동 선택 (Requirements: 16.3)
      if (response.suggestedItemTypes.length > 0) {
        setTimeout(() => {
          autoCheckFromAI(response.suggestedItemTypes);
        }, 500);
      }
    } catch (err: unknown) {
      const aiMsg: ChatMessage = {
        id: ++chatIdRef.current,
        text: 'AI 추천을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.',
        sender: 'ai',
      };
      setChatMessages(prev => [...prev, aiMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // 채팅 스크롤 자동 이동
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleRentalClick = () => {
    const checked = currentChecklistItems.filter(item => checkedItems[item.id]);
    if (checked.length === 0) {
      alert('체크한 항목이 없습니다.');
      return;
    }
    navigate('/checked-items', {
      state: {
        checkedItems: checked,
        category: activeCategory
      }
    });
  };


  const handleAIChat = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage = chatInput.trim();

    // 1. 낙관적 UI: 유저 메시지를 즉시 화면에 렌더링 + input 즉시 비우기
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChat('');

    // 2. 로딩 상태 ON → "AI가 생각 중입니다..." 말풍선 표시
    setIsChatLoading(true);

    try {
      // 3. 비동기 대기: 백엔드 API 응답 기다리기
      const result = await sendAIChat(userMessage);

      // 체크박스 자동 선택
      const newChecked = { ...checkedItems };
      currentChecklistItems.forEach(item => {
        const matched = result.suggestedItemTypes?.some(
          (suggested: string) =>
            item.title.includes(suggested) || suggested.includes(item.title)
        );
        if (matched) {
          newChecked[item.id] = true;
        }
      });
      setCheckedItems(newChecked);

      // AI 답변 말풍선 추가
      setChatMessages(prev => [...prev, { sender: 'ai', text: result.reply }]);
    } catch (error) {
      console.error('AI 호출 실패:', error);
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: 'AI 추천을 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' },
      ]);
    } finally {
      // 4. 로딩 상태 OFF
      setIsChatLoading(false);
    }
  };

  
  

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="text-xl font-bold text-gray-900 hover:text-purple-600 transition-colors">
            HARUMAN
          </button>
          <div className="text-[10px] text-gray-500">Buy Less, Experience More</div>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button className="text-gray-600 hover:text-gray-900 transition-colors">
            <Heart className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(isAuthenticated ? '/mypage' : '/login')}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Left Sidebar - Categories */}
        <div className="w-60 bg-white border-r border-gray-200 p-5">
        <div className="mb-8">
          <div className="text-sm text-gray-500 mb-1">카테고리</div>
        </div>

        <div className="space-y-1">
          {categories.map((cat, idx) => (
            <button
              key={idx}
              onClick={() => setActiveCategory(cat.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                activeCategory === cat.label
                  ? 'bg-purple-50 text-purple-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - Checklist */}
      <div className="flex-1 overflow-auto p-8 pb-28">
        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">{activeCategory}</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">{activeCategory} 준비 체크리스트</h1>
            <p className="text-sm text-gray-600">
              필요한 물품을 체크해주세요.
            </p>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3 mb-6">
            {currentChecklistItems.length > 0 ? (
              currentChecklistItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 bg-white rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => toggleCheck(item.id)}
                >
                  <div className="flex-shrink-0">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        checkedItems[item.id]
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {checkedItems[item.id] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.title}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p>체크리스트 항목이 없습니다.</p>
                <p className="text-sm mt-1">AI 챗봇에게 추천을 요청해보세요!</p>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-60 right-80 bg-white border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleRentalClick}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-medium transition-colors"
            >
              대여하기
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - AI Chat */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              AI
            </div>
            <div>
              <div className="font-medium text-sm">챗봇</div>
              <div className="text-xs text-gray-500">AI 어시스턴트</div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-auto">
  <div className="space-y-3">
    {chatMessages.map((msg, idx) => (
      <div
        key={idx}
        className={`flex ${
          msg.sender === 'user'
            ? 'justify-end'
            : 'justify-start'
        }`}
      >
        <div
          className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
            msg.sender === 'user'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {msg.text}
          <div className="space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <p>AI 챗봇에게 물어보세요!</p>
                <p className="mt-1">필요한 물품을 추천받을 수 있어요.</p>
                <p className="mt-3 text-xs text-gray-300">예: "콘서트 갈 건데 뭐 필요해?"</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.sender === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.suggestedItemTypes && msg.suggestedItemTypes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.suggestedItemTypes.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full"
                          >
                            ✓ {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span className="text-sm text-gray-500">생각 중...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>
    ))}
    {isChatLoading && (
      <div className="flex justify-start">
        <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          <span className="text-sm text-gray-500">AI가 생각 중입니다...</span>
        </div>
      </div>
    )}
  </div>
</div>

        <div className="p-4 border-t border-gray-200">
          {chatError && (
            <p className="text-xs text-red-500 mb-2">{chatError}</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIChat(); } }}
              placeholder="무엇이 궁금하신가요?"
              onKeyDown={handleChatKeyPress}
              placeholder="무엇이 궁금하신가요?"
              maxLength={500}
              disabled={isChatLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-400 disabled:opacity-50"
            />
            <button
              onClick={handleAIChat}
              onClick={handleChatSend}
              disabled={isChatLoading || !chatInput.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1 text-right">{chatInput.length}/500</p>
        </div>
      </div>
      </div>
    </div>
  );
}

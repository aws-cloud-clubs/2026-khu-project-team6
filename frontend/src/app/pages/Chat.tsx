import { ArrowLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || {};

  const [message, setMessage] = useState('');

  // 상품 ID별 채팅 기록 (대여 내역에서 온 경우)
  const chatHistory: { [key: number]: any[] } = {
    2: [ // 캠핑 텐트 4인용 (직거래)
      {
        id: 1,
        text: '안녕하세요! 상품 문의 주셔서 감사합니다.',
        sender: 'seller',
        time: '오후 2:30',
      },
      {
        id: 2,
        text: '캠핑 텐트 대여 가능한가요?',
        sender: 'buyer',
        time: '오후 2:32',
      },
      {
        id: 3,
        text: '네, 가능합니다! 원하시는 날짜가 언제인가요?',
        sender: 'seller',
        time: '오후 2:33',
      },
      {
        id: 4,
        text: '1월 20일부터 22일까지 대여하고 싶습니다.',
        sender: 'buyer',
        time: '오후 2:35',
      },
      {
        id: 5,
        text: '해당 날짜에 예약 가능합니다. 만나서 거래하시면 됩니다!',
        sender: 'seller',
        time: '오후 2:36',
      },
      {
        id: 6,
        text: '감사합니다! 어디서 만날까요?',
        sender: 'buyer',
        time: '오후 2:37',
      },
      {
        id: 7,
        text: '강남역 2번 출구 앞에서 만나면 좋을 것 같습니다.',
        sender: 'seller',
        time: '오후 2:38',
      },
    ],
  };

  const [messages, setMessages] = useState(
    chatHistory[product.id] || [
      {
        id: 1,
        text: '안녕하세요! 상품 문의 주셔서 감사합니다.',
        sender: 'seller',
        time: '오후 2:30',
      },
    ]
  );

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'buyer',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">판매자와 채팅</h1>
            <p className="text-xs text-gray-500">{product.title}</p>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="bg-white border-b border-gray-200 px-8 py-3 pointer-events-none">
        <div className="flex gap-3 items-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium line-clamp-1">{product.title}</p>
            <p className="text-sm text-purple-600 font-bold">{product.price}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'buyer' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs ${
                  msg.sender === 'buyer'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-900'
                } rounded-xl px-4 py-3 shadow-sm`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender === 'buyer' ? 'text-purple-200' : 'text-gray-400'
                }`}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={handleSend}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

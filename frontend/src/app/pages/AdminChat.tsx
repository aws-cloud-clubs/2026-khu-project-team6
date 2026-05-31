import { ArrowLeft, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';

export default function AdminChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const product = location.state?.product || {};

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: '안녕하세요! HARUMAN 고객센터입니다. 무엇을 도와드릴까요?',
      sender: 'admin',
      time: '오후 3:00',
    },
  ]);

  const handleSend = () => {
    if (!message.trim()) return;

    const newMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'user',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    // 관리자 자동 응답 (시뮬레이션)
    setTimeout(() => {
      const adminResponse = {
        id: messages.length + 2,
        text: '문의 내용을 확인했습니다. 곧 담당자가 답변드리겠습니다.',
        sender: 'admin',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, adminResponse]);
    }, 1000);
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
            <h1 className="text-xl font-bold">관리자 문의</h1>
            <p className="text-xs text-gray-500">HARUMAN 고객센터</p>
          </div>
        </div>
      </div>

      {/* Product Info (if available) */}
      {product.title && (
        <div className="bg-white border-b border-gray-200 px-8 py-3">
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
            <span className="text-xs text-gray-500">문의 상품</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs ${
                  msg.sender === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-900'
                } rounded-xl px-4 py-3 shadow-sm`}
              >
                {msg.sender === 'admin' && (
                  <p className="text-xs text-purple-600 font-medium mb-1">관리자</p>
                )}
                <p className="text-sm">{msg.text}</p>
                <p className={`text-xs mt-1 ${
                  msg.sender === 'user' ? 'text-purple-200' : 'text-gray-400'
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
            placeholder="문의 내용을 입력하세요"
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

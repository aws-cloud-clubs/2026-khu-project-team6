import { ClipboardList, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const experienceImages = [
  {
    url: 'https://images.unsplash.com/photo-1576064535163-095bccc642b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25jZXJ0JTIwc2lsaG91ZXR0ZSUyMGdvbGRlbiUyMGhvdXIlMjBhZXN0aGV0aWMlMjBjaW5lbWF0aWMlMjBjcm93ZHxlbnwxfHx8fDE3ODAyMDUzMTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '콘서트',
  },
  {
    url: 'https://images.unsplash.com/photo-1697981627107-90b1986876f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFkdWF0aW9uJTIwc3Vuc2V0JTIwZ29sZGVuJTIwaG91ciUyMGRyZWFteSUyMGFlc3RoZXRpYyUyMGVtb3Rpb25hbHxlbnwxfHx8fDE3ODAyMDUzMTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '졸업사진',
  },
  {
    url: 'https://images.unsplash.com/photo-1610892415063-d89a504ce049?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjBhZXN0aGV0aWMlMjBkcmVhbXklMjBzdW5zZXQlMjBtb3VudGFpbnMlMjBjaW5lbWF0aWMlMjB3YW5kZXJsdXN0fGVufDF8fHx8MTc4MDIwNTMxOXww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '여행',
  },
  {
    url: 'https://images.unsplash.com/photo-1600529303996-091441a95675?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwYWVzdGhldGljJTIwZ29sZGVuJTIwaG91ciUyMGRyZWFteSUyMHRlbnQlMjBzdGFycyUyMG1pbGt5JTIwd2F5fGVufDF8fHx8MTc4MDIwNTMxOXww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '캠핑',
  },
  {
    url: 'https://images.unsplash.com/photo-1770301312385-7a4ba2f12147?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwYWVzdGhldGljJTIwZHJlYW15JTIwcm9tYW50aWMlMjBnb2xkZW4lMjBob3VyJTIwY291cGxlJTIwc2lsaG91ZXR0ZXxlbnwxfHx8fDE3ODAyMDUzMTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '결혼식',
  },
  {
    url: 'https://images.unsplash.com/photo-1643675234810-815efd6373d4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZXN0aGV0aWMlMjB3b3Jrc3BhY2UlMjBnb2xkZW4lMjBob3VyJTIwbWluaW1hbGlzdCUyMGRyZWFteSUyMGNvZmZlZXxlbnwxfHx8fDE3ODAyMDUzMjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '면접',
  },
  {
    url: 'https://images.unsplash.com/photo-1611244806964-91d204d4a2a7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmZXN0aXZhbCUyMHN1bnNldCUyMHNpbGhvdWV0dGUlMjBhZXN0aGV0aWMlMjBkcmVhbXklMjBjcm93ZCUyMGxpZ2h0c3xlbnwxfHx8fDE3ODAyMDUzMjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '페스티벌',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % experienceImages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsLoggedIn(localStorage.getItem('isLoggedIn') === 'true');
  }, []);

  const handleSearchClick = () => {
    setIsAnimating(true);
    setTimeout(() => {
      navigate('/app');
    }, 2000);
  };

  const categories = [
    {
      title: '카메라 2,000원',
      subtitle: '(1일 기준, 10월 평균)',
      image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBjYW1lcmElMjBwaG90b2dyYXBoeSUyMGVxdWlwbWVudHxlbnwxfHx8fDE3ODAyMDM1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: '캠핑 랜턴',
      subtitle: '(1일 기준, 10월 평균)',
      image: 'https://images.unsplash.com/photo-1466220549276-aef9ce186540?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwY29va2luZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3ODAyMDM1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: '캠핑 의자 2,000원',
      subtitle: '(1일 기준, 10월 평균)',
      image: 'https://images.unsplash.com/photo-1618886614638-80e3c103d31a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3JtYWwlMjBzdWl0JTIwamFja2V0JTIwY2xvdGhpbmd8ZW58MXx8fHwxNzgwMjAzNTYwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: '코펠 세트',
      subtitle: '(1일 기준, 10월 평균)',
      image: 'https://images.unsplash.com/photo-1466220549276-aef9ce186540?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwY29va2luZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3ODAyMDM1NjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'DSLR 카메라',
      subtitle: '(1일 기준, 10월 평균)',
      image: 'https://images.unsplash.com/photo-1542754482-8fd5c91d006e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcm9uZSUyMGNhbWVyYSUyMGdvcHJvfGVufDF8fHx8MTc4MDIwMzU2MXww&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="text-xl font-bold text-gray-900">HARUMAN</div>
          <div className="text-[10px] text-gray-500">Buy Less, Experience More</div>
        </div>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <button
              onClick={() => navigate('/mypage')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              마이페이지
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative h-[350px] overflow-hidden mt-16">
        {experienceImages.map((image, index) => (
          <ImageWithFallback
            key={index}
            src={image.url}
            alt={image.alt}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <motion.div
            className="text-center text-white mb-6"
            initial={{ opacity: 1 }}
            animate={{ opacity: isAnimating ? 0 : 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="max-w-2xl">
              <div className="text-sm mb-3 text-white/90">새로운 경험을 준비할 때,</div>
              <h1 className="text-4xl mb-3 leading-tight font-bold">
                <span className="text-blue-300">체크리스트</span>를 만들어볼까요?
              </h1>
              <p className="text-sm text-white/80 leading-relaxed">
                필요한 것만 체크하고, 더 가볍고 편안한 경험을 만들어보세요.
              </p>
            </div>
          </motion.div>

          <div className="relative">
            <motion.button
              onClick={handleSearchClick}
              className="flex flex-col items-center gap-4 group relative z-10"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/40 group-hover:bg-white/30 transition-all"
                animate={isAnimating ? { opacity: 0 } : {}}
                transition={{ duration: 0.5 }}
              >
                <ClipboardList className="w-10 h-10 text-white" />
              </motion.div>
              <motion.div
                animate={isAnimating ? { opacity: 0 } : { y: [0, 8, 0] }}
                transition={isAnimating ? { duration: 0.3 } : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-6 h-6 text-white/80" />
              </motion.div>
            </motion.button>

            {/* Circle Expand Transition */}
            {isAnimating && (
              <>
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
                  style={{ perspective: '1000px' }}
                >
                  <motion.div
                    className="rounded-full bg-white"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 100, opacity: 1 }}
                    transition={{
                      duration: 1.8,
                      ease: [0.76, 0, 0.24, 1],
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                    }}
                  />
                </motion.div>

                {/* Subtle particle effect */}
                <div className="fixed inset-0 z-50 pointer-events-none">
                  {[...Array(20)].map((_, i) => {
                    const angle = (i / 20) * Math.PI * 2;
                    const distance = 150 + Math.random() * 200;
                    return (
                      <motion.div
                        key={`particle-${i}`}
                        className="absolute rounded-full bg-purple-300"
                        style={{
                          width: `${Math.random() * 4 + 2}px`,
                          height: `${Math.random() * 4 + 2}px`,
                          left: '50%',
                          top: '50%',
                        }}
                        initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                        animate={{
                          opacity: [0, 0.6, 0],
                          scale: [0, 1, 0.5],
                          x: Math.cos(angle) * distance,
                          y: Math.sin(angle) * distance,
                        }}
                        transition={{
                          duration: 1.5,
                          delay: i * 0.03,
                          ease: "easeOut",
                        }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="bg-gray-50 px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-lg font-medium">인기 렌탈 카테고리 추천</h2>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {categories.map((category, index) => (
              <div
                key={index}
                className="group cursor-pointer"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gray-200">
                  <ImageWithFallback
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium mb-0.5">{category.title}</div>
                  <div className="text-[10px] text-gray-500">{category.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

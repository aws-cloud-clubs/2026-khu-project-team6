import { Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { useState, useEffect } from 'react';

const experienceImages = [
  {
    url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25jZXJ0JTIwbXVzaWMlMjBmZXN0aXZhbCUyMGNyb3dkfGVufDF8fHx8MTc4MDIwNDA4M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '콘서트',
  },
  {
    url: 'https://images.unsplash.com/photo-1633734973050-d6499a977c17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmFkdWF0aW9uJTIwY2VyZW1vbnklMjBwaG90byUyMHBvcnRyYWl0fGVufDF8fHx8MTc4MDIwNDA4M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '졸업사진',
  },
  {
    url: 'https://images.unsplash.com/photo-1708403120467-1715bb6840df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmF2ZWwlMjB2YWNhdGlvbiUyMHN1aXRjYXNlJTIwYWlycG9ydHxlbnwxfHx8fDE3ODAyMDQwODR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '여행',
  },
  {
    url: 'https://images.unsplash.com/photo-1550957886-ac45931e5779?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwdGVudCUyMG5hdHVyZSUyMG91dGRvb3J8ZW58MXx8fHwxNzgwMjA0MDg0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '캠핑',
  },
  {
    url: 'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwY2VyZW1vbnklMjBlbGVnYW50fGVufDF8fHx8MTc4MDIwNDA4NXww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '결혼식',
  },
  {
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqb2IlMjBpbnRlcnZpZXclMjBidXNpbmVzcyUyMHN1aXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzgwMjA0MDg1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '면접',
  },
  {
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNpYyUyMGZlc3RpdmFsJTIwb3V0ZG9vciUyMHBhcnR5fGVufDF8fHx8MTc4MDIwNDA4NXww&ixlib=rb-4.1.0&q=80&w=1080',
    alt: '페스티벌',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % experienceImages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {experienceImages.map((image, index) => (
        <ImageWithFallback
          key={index}
          src={image.url}
          alt={image.alt}
          className={`absolute inset-0 w-full h-screen object-cover transition-opacity duration-1000 ${
            index === currentImageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
        <button
          onClick={() => navigate('/home')}
          className="w-20 h-20 bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 rounded-full flex items-center justify-center border-2 border-white/40 hover:border-white/60 hover:scale-110"
        >
          <Search className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}

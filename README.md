# 🏠 HARUMAN (하루만) — 맞춤형 대여 중개 및 AI 추천 플랫폼

> **"새로운 바이럴, 한번만 해보자"** — 경희대학교 2026 ACC 프로젝트 Team 6

판매자(대여자)와 구매자(대여받는 자)를 연결하는 P2P/B2C 대여 중개 매칭 플랫폼입니다. 

**"원하는 것만 체크, 필요한 것만 모아보기"**
AI 챗봇이 사용자의 상황을 분석해 필요한 물품을 자동 추천하고, 에스크로 보증금 시스템으로 안전한 거래를 보장합니다.

*"끼워팔기는 그만, 무의미한 방치도 그만! 쏟아지는 바이럴 속 원하는 경험을 한번만 체험해보고 싶다면 HARUMAN 빌려보자"*

🌐 **도메인**: [haruman.shop](https://haruman.shop)

---

## 📋 목차

- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [프로젝트 구조](#-프로젝트-구조)
- [시작하기](#-시작하기)
- [환경 변수](#-환경-변수)
- [데이터베이스](#-데이터베이스)
- [API 엔드포인트](#-api-엔드포인트)
- [팀원](#-팀원)

---

## ✨ 주요 기능

### 🤖 AI 기반 물품 추천 챗봇
- AWS Bedrock Nova Lite 모델 연동
- 사용자 대화 맥락 분석 → 필요 물품 자동 추론
- 챗봇 결과와 체크박스 UI 실시간 동기화

### 💬 실시간 1:1 채팅
- WebSocket 기반 판매자-구매자 직거래 상담
- **Clean_Bot**: AI 비속어/욕설 실시간 필터링 (Bedrock Nova Lite, 5초 타임아웃)

### 🔐 인증 및 보안
- Supabase Auth + 이메일 인증 (Resend API)
- JWT 기반 세션 관리
- RBAC (Guest / User / Admin)

### 📦 대여 관리 및 에스크로
- 대여 생명주기: 예약확정시 → 대여중 → 반납완료
- 에스크로 보증금 시스템 (연체 시 일별 20% 차감, 5일 이상 전액 몰수)

### 🔔 실시간 알림
- WebSocket 기반 푸시 알림
- FCM 토큰 지원
- 반납 기한 임박 자동 알림

### 🛡️ 사기 방지
- 결제 카드 사전 등록제 (거래 전 카드 인증 필수)
- 양자 결제 확인 (buyer_confirmed + seller_confirmed)

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS 4, shadcn/ui, MUI Icons |
| **Backend** | Express.js (Node.js), TypeScript, JWT, bcrypt |
| **Database** | Supabase PostgreSQL (Serverless) |
| **AI/ML** | AWS Bedrock (Amazon Nova Lite v1) |
| **Auth** | Supabase Auth, Resend (이메일 인증) |
| **실시간** | WebSocket (ws 라이브러리), API Gateway WebSocket |
| **Storage** | AWS S3 (이미지 업로드) |
| **배포** | AWS Lambda, API Gateway, S3 + CloudFront |
| **테스트** | Jest, fast-check (Property-Based Testing) |
| **코드 품질** | ESLint, Prettier |

---

## 📁 프로젝트 구조

```
haruman/
├── backend/                    # Express 백엔드 서버
│   ├── main.js                 # 진입점 (Express 앱 + 라우팅)
│   ├── src/
│   │   ├── ai/                 # AI 챗봇 핸들러 (Bedrock Nova Lite)
│   │   ├── auth/               # 인증 (회원가입, 로그인, 이메일 인증, JWT)
│   │   ├── chat/               # 채팅 (메시지 전송, CleanBot 필터)
│   │   ├── common/             # 공통 유틸 (config, errors, response)
│   │   ├── db/                 # Supabase 클라이언트
│   │   ├── mocks/              # 테스트용 Mock (Bedrock, SES)
│   │   ├── notify/             # 푸시 알림 (FCM)
│   │   └── websocket/          # WebSocket 연결/해제 핸들러
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # React SPA (Vite)
│   ├── src/
│   │   ├── api/                # API 클라이언트 (auth, items, rentals, users, ai)
│   │   ├── app/
│   │   │   ├── components/     # UI 컴포넌트 (Figma 기반)
│   │   │   └── pages/          # 페이지 (Home, Chat, Rental, MyPage 등)
│   │   ├── context/            # Context (Auth, WebSocket, Notification)
│   │   ├── lib/                # Supabase 클라이언트
│   │   └── styles/             # CSS (Tailwind, 테마, 폰트)
│   └── package.json
│
├── infra/                      # 인프라 및 DB 스키마
│   └── database/               # PostgreSQL 마이그레이션 (001~010)
│
└── README.md
```

---

## 🚀 시작하기

### 사전 요구사항

- Node.js 20+
- npm 또는 pnpm
- Supabase 프로젝트 (PostgreSQL)
- AWS 계정 (Bedrock, S3 접근 권한)

### Backend 설치 및 실행

```bash
cd backend
npm install

# .env 파일 설정 (아래 환경 변수 섹션 참고)
cp .env.example .env

# 개발 서버 실행
npm run dev

# 프로덕션 실행
npm start
```

### Frontend 설치 및 실행

```bash
cd frontend
pnpm install   # 또는 npm install

# .env 파일 설정
cp .env.example .env

# 개발 서버 실행
pnpm dev
```

### 테스트 실행

```bash
cd backend

# 전체 테스트
npm test

# 단위 테스트만
npm run test:unit

# Property-Based 테스트만
npm run test:property
```

---

## 🔑 환경 변수

### Backend (`backend/.env`)

| 변수 | 설명 |
|------|------|
| `NODE_ENV` | 실행 환경 (`development` / `production` / `test`) |
| `PORT` | 서버 포트 (기본: 3000) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_KEY` | Supabase 공개 키 (anon key) |
| `SUPABASE_SERVICE_KEY` | Supabase 서비스 롤 키 (서버 전용) |
| `JWT_SECRET` | JWT 서명 비밀 키 |
| `AWS_ACCESS_KEY_ID` | AWS 액세스 키 |
| `AWS_SECRET_ACCESS_KEY` | AWS 시크릿 키 |
| `AWS_REGION` | AWS 리전 |
| `RESEND_API_KEY` | Resend 이메일 API 키 |
| `RESEND_FROM_EMAIL` | 발신 이메일 주소 |
| `FRONTEND_URL` | 프론트엔드 URL (CORS) |
| `WS_ENDPOINT` | WebSocket API Gateway 엔드포인트 |
| `S3_BUCKET` | S3 버킷명 |

### Frontend (`frontend/.env`)

| 변수 | 설명 |
|------|------|
| `VITE_API_BASE_URL` | 백엔드 API URL |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 공개 키 |

---

## 🗄 데이터베이스

Supabase PostgreSQL 기반. 마이그레이션 파일은 `infra/database/` 에 순번대로 위치합니다.

### 테이블 구성

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 (User, Admin) |
| `user_agreements` | 약관 동의 이력 |
| `cards` | 결제 카드 사전 등록 |
| `categories` | 물품 카테고리 (7개: 콘서트, 졸업사진, 여행, 캠핑, 결혼식, 면접, 페스티벌) |
| `item_types` | 카테고리별 세부 물품 타입 |
| `items` | 대여 물품 |
| `rentals` | 대여 거래 (에스크로 보증금 포함) |
| `receipt_photos` | 수령 인증 사진 |
| `chat_rooms` | 1:1 채팅방 |
| `chat_messages` | 채팅 메시지 (CleanBot 필터링 상태) |
| `notifications` | 알림 |
| `ws_connections` | WebSocket 활성 연결 |
| `reports` | 신고 내역 |

### 스키마 적용

```bash
# Supabase Dashboard SQL Editor에서 순서대로 실행
# 또는 psql CLI로:
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
psql "$DATABASE_URL" -f infra/database/001_schema.sql
psql "$DATABASE_URL" -f infra/database/002_indexes.sql
psql "$DATABASE_URL" -f infra/database/003_seed.sql
# ... 010까지 순차 적용
```

---

## 📡 API 엔드포인트

### 인증 (Auth)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/register` | 회원가입 |
| POST | `/auth/login` | 로그인 |
| GET | `/auth/me` | 내 정보 조회 |
| POST | `/auth/verify-email` | 이메일 인증 확인 |
| POST | `/auth/resend-verification` | 인증 메일 재발송 |

### AI 챗봇
| Method | Path | 설명 |
|--------|------|------|
| POST | `/ai/chat` | AI 물품 추천 대화 |

### 채팅
| Method | Path | 설명 |
|--------|------|------|
| POST | `/chat/send` | 메시지 전송 (CleanBot 검사 포함) |

### WebSocket
| Event | 설명 |
|-------|------|
| `$connect` | WebSocket 연결 |
| `$disconnect` | WebSocket 해제 |

---

## 📂 카테고리 및 물품 분류

| 카테고리 | 세부 물품 |
|----------|-----------|
| 🎤 콘서트 | 울트라 핸드폰, 대포카메라, 응원봉, 손풍기, 보조배터리, 쌍안경, 돗자리, 기타 |
| 🎓 졸업사진 | 학사모, 졸업가운, 꽃다발, 정장, 구두, 기타 |
| ✈️ 여행 | 돼지코, 캐리어, 디카, 보조배터리, 고프로, 여행용 와이파이(에그), 기타 |
| 🏕️ 캠핑 | 텐트, 타프, 쉘터, 침구, 계절용품, 조리도구, 식기, 의자, 테이블 등 |
| 💍 결혼식 | 하객룩, 구두, 넥타이, 기타 |
| 💼 면접 | 면접룩, 구두, 기타 |
| 🏖️ 페스티벌 | 의상, 방수팩, 선글라스, 기타 |

---

## 👥 팀원

**경희대학교 컴퓨터공학과 ACC 2026 프로젝트 — Team 6**
2024103291 고명주 myoungjugo
2025105390 오소원 wanimetro

---

## 📄 라이선스

이 프로젝트는 학술 목적으로 개발되었습니다.

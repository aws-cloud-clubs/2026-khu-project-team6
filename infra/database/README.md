# HARUMAN Rental Platform — Database Schema

Supabase PostgreSQL 스키마 파일 및 적용 방법을 설명합니다.

---

## 파일 구조

```
infra/database/
├── 001_schema.sql   # 전체 테이블 DDL (CHECK 제약조건, UNIQUE, FK 포함)
├── 002_indexes.sql  # 성능 최적화 인덱스
├── 003_seed.sql     # 초기 카테고리 및 아이템 타입 시드 데이터
└── README.md        # 이 파일
```

---

## 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | 플랫폼 사용자 계정 (User, Admin) |
| `user_agreements` | 약관 동의 이력 (서비스 이용약관, 개인정보처리방침, 보증금 차감 정책) |
| `cards` | 결제 카드 사전 등록 (PG 검증 완료 카드) |
| `categories` | 물품 카테고리 (콘서트, 졸업사진, 여행, 캠핑, 결혼식, 면접, 페스티벌) |
| `item_types` | 카테고리별 세부 물품 타입 |
| `items` | 판매자 등록 대여 물품 |
| `rentals` | 대여 거래 레코드 (에스크로 보증금 포함) |
| `receipt_photos` | 수령 인증 사진 (S3 키 저장) |
| `chat_rooms` | 1:1 채팅방 (Direct_Trade 전용) |
| `chat_messages` | 채팅 메시지 (Clean_Bot 필터링 상태 포함) |
| `notifications` | 사용자 알림 (WebSocket, 이메일, SMS) |
| `ws_connections` | WebSocket 활성 연결 관리 |

---

## 스키마 적용 방법

### 방법 1: Supabase Dashboard SQL Editor (권장)

1. [Supabase Dashboard](https://app.supabase.com) 접속
2. 프로젝트 선택 → **SQL Editor** 탭 이동
3. 아래 순서대로 각 파일 내용을 붙여넣고 **Run** 실행:
   1. `001_schema.sql` — 테이블 생성
   2. `002_indexes.sql` — 인덱스 생성
   3. `003_seed.sql` — 시드 데이터 삽입

### 방법 2: psql CLI

Supabase 프로젝트의 **Database → Connection string** 에서 URI를 복사한 후:

```bash
# 환경변수 설정
export DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# 순서대로 적용
psql "$DATABASE_URL" -f infra/database/001_schema.sql
psql "$DATABASE_URL" -f infra/database/002_indexes.sql
psql "$DATABASE_URL" -f infra/database/003_seed.sql
```

### 방법 3: Supabase CLI

```bash
# Supabase CLI 설치 (최초 1회)
npm install -g supabase

# 로그인 및 프로젝트 연결
supabase login
supabase link --project-ref <PROJECT_REF>

# 마이그레이션 파일로 복사 후 적용
cp infra/database/001_schema.sql supabase/migrations/20240101000001_schema.sql
cp infra/database/002_indexes.sql supabase/migrations/20240101000002_indexes.sql
cp infra/database/003_seed.sql supabase/migrations/20240101000003_seed.sql

supabase db push
```

---

## 적용 순서 주의사항

반드시 **001 → 002 → 003** 순서로 적용해야 합니다.

- `002_indexes.sql`은 `001_schema.sql`의 테이블이 존재해야 실행 가능합니다.
- `003_seed.sql`은 `001_schema.sql`의 `categories`, `item_types` 테이블이 존재해야 실행 가능합니다.

---

## 시드 데이터 확인

적용 후 아래 쿼리로 시드 데이터를 검증할 수 있습니다:

```sql
-- 카테고리별 아이템 타입 수 확인
SELECT c.name AS category, COUNT(it.id) AS item_type_count
FROM categories c
LEFT JOIN item_types it ON it.category_id = c.id
GROUP BY c.name
ORDER BY c.name;
```

예상 결과:

| category | item_type_count |
|----------|-----------------|
| 결혼식   | 4               |
| 면접     | 3               |
| 졸업사진 | 6               |
| 캠핑     | 13              |
| 콘서트   | 8               |
| 페스티벌 | 4               |
| 여행     | 7               |

---

## 재적용 (초기화)

> ⚠️ **주의**: 아래 명령은 모든 데이터를 삭제합니다. 개발 환경에서만 사용하세요.

```sql
-- 테이블 삭제 (FK 의존성 역순)
DROP TABLE IF EXISTS ws_connections CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS receipt_photos CASCADE;
DROP TABLE IF EXISTS rentals CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS item_types CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS user_agreements CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

삭제 후 001 → 002 → 003 순서로 재적용합니다.

---

## 관련 요구사항

- **Requirements 4.2**: 카테고리 및 아이템 타입 목록 (시드 데이터 기준)
- **Requirements 1.7**: 비밀번호 bcrypt 해시 저장 (`users.password_hash`)
- **Requirements 7.3~7.5**: 에스크로 보증금 (`rentals.deposit_amount`, `deposit_held`, `delay_days`)
- **Requirements 12.4~12.5**: Clean_Bot 경고 (`chat_messages.clean_bot_status`, `warning_count`)

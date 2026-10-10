# SRIAN

> 사람인 에이전트 단기알바 채용 공고 알림 Discord Bot

[![Firebase](https://img.shields.io/badge/Firebase-Functions-orange?logo=firebase)](https://firebase.google.com/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue?logo=discord)](https://discord.js.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18-green?logo=node.js)](https://nodejs.org/)

---

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [프로젝트 구조](#프로젝트-구조)
- [시작하기](#시작하기)
- [사용 가이드](#사용-가이드)
- [배포](#배포)
- [기여하기](#기여하기)
- [문서](#문서)
- [라이선스](#라이선스)
- [문의](#문의)

---

## 개요

사람인 에이전트 단기알바 채용공고 알림 봇은 사람인 에이전트 웹사이트의 단기알바 채용 공고를 Discord Bot을 통해 사용자에게 알림을 제공하는 서비스입니다.

### 핵심 가치

- **실시간 알림**: 4시간 주기로 새로운 채용 공고를 즉시 알림
- **개인화된 설정**: 지역별 필터링, 알림 모드 설정 (전체/선택)
- **높은 안정성**: 3-tier 캐싱 전략 (Redis → Firestore → Crawling)
- **확장 가능**: Event-Driven Architecture로 기능 추가 용이
- **AI 지원**: Hugging Face 무료 AI 모델 활용

---

## 주요 기능

### 1. 공고 요청 (`/recruit-request`)
- 즉시 채용 공고 조회
- 3-tier 캐싱 전략 (Redis → Firestore → Crawling)
- Discord 임베드 형식 제공

### 2. 알림 설정 (`/alarm-subscribe`)
- 개인 맞춤형 알림 설정
- 알림 모드: 전체 공고 / 특정 지역만
- 지역 선택 및 알림 ON/OFF

### 3. 자동 알림 (4시간 주기)
- 새 공고 감지 및 알림
- SHA-256 해시 기반 변경 감지
- 구독자 필터링 및 DM 발송

### 4. 에러 자동 리포팅
- 시스템 에러 자동 감지 및 관리자 알림
- 에러 로그 저장

### 5. 관리자 기능
- 전체 사용자 공지 (`/admin-broadcast`)
- 발송 진행률 및 통계 제공

### 6. AI 자연어 처리
- Hugging Face 무료 모델 활용
- 자연어 명령 처리 및 의도 분석
- Firestore 캐싱으로 API 최적화

---

## 기술 스택

### Backend
- **Runtime**: Node.js 18
- **Platform**: Firebase Functions (Serverless)
- **Language**: TypeScript 5.1
- **Framework**: Express 4.21

### Database & Cache
- **Primary DB**: Firebase Firestore
- **Cache Layer**: Redis 4.7
- **Caching Strategy**: 3-tier (Redis → Firestore → Crawling)

### External APIs
- **Discord**: discord.js 14.17
- **Web Scraping**: Playwright 1.47
- **AI**: Hugging Face Inference API

### DevOps
- **Testing**: Vitest (Jest API compatible)
- **Linting**: ESLint
- **CI/CD**: Firebase Hosting & Functions

---

## 아키텍처

### System Overview

```
Firebase Functions (asia-northeast3)
├── Entry Points
│   ├── HTTP (Express)
│   ├── Discord Events
│   └── Schedulers (4h/6h)
│
├── Presentation Layer (events/)
│   └── Discord 이벤트 라우팅
│
├── Application Layer
│   ├── eventBus/     → 비즈니스 이벤트 허브
│   ├── services/     → 비즈니스 로직
│   └── features/     → 기능별 모듈
│
└── Integration Layer
    ├── providers/    → 외부 API 통합
    └── crawlers/     → 웹 크롤링

External Services
├── Discord API
├── Firestore
├── Redis
└── Hugging Face (Phase 4)
```

### Event-Driven Architecture

**EventBus (Node.js EventEmitter)**

```typescript
// 타입 안전 이벤트 시스템
eventBus.emitEvent('RECRUIT_NEW', { addedJobs, updatedJobs, deletedIds });
eventBus.onEvent('RECRUIT_NEW', async (data) => {
  await notificationService.notifyNewRecruits(data);
});
```

**이벤트 도메인**:
- **Recruit**: 크롤링, 새 공고, 공고 요청
- **Notification**: 구독, 알림 발송
- **System**: 에러 처리 및 로깅
- **Admin**: 관리자 기능

### Data Flow

#### 사용자 요청 플로우
```
Discord User
  ↓ /recruit-request
events/ (Presentation)
  ↓
services/ (Application)
  ↓ Redis → Firestore → Crawling
providers/ (Integration)
  ↓
Discord Response (Embed)
```

#### 자동 알림 플로우
```
RecruitScheduler (4시간)
  ↓
recruitCacheService.setRecruitList()
  ↓ SHA-256 hash comparison
diffJobs() → { addedJobs, updatedJobs, deletedIds }
  ↓
eventBus.emit('recruit.new')
  ↓
notificationService.on('recruit.new')
  ↓ filter by region & mode
사용자별 Discord DM 발송
```

## 프로젝트 구조

```
sria-notify-discord/
├── functions/                  # Firebase Functions 코드
│   ├── src/
│   │   ├── eventBus/          # 비즈니스 이벤트 시스템
│   │   ├── events/            # Discord 이벤트 핸들러
│   │   ├── features/          # 기능별 모듈
│   │   ├── services/          # 비즈니스 로직
│   │   ├── providers/         # 외부 서비스 통합
│   │   ├── crawlers/          # 웹 크롤링
│   │   ├── common/            # 공통 유틸리티
│   │   └── app/               # 진입점
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── firebase.json               # Firebase 프로젝트 설정
└── README.md
```

---

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Firebase CLI (`npm install -g firebase-tools`)
- Redis Server (로컬 또는 클라우드)
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/sria-notify-discord.git
cd sria-notify-discord/functions

# 개발 환경 설정
git config merge.ours.driver true

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일 편집
```

### 환경 변수

`.env` 파일 작성:

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id

# Discord
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_APP_ID=your-app-id
ADMIN_USER_ID=your-discord-user-id

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Hugging Face
HUGGINGFACE_API_KEY=your-api-key
```

### 로컬 실행

```bash
# 개발 서버 실행 (hot reload)
npm run dev

# 또는 빌드 후 에뮬레이터 실행
npm run serve
```

### Discord 명령어 등록

```bash
# Slash Commands 등록
npm run register:commands
```

---

## 사용 가이드

### Discord 명령어

#### `/recruit-request`
채용 공고 목록을 즉시 조회합니다.

```
사용법: /recruit-request
응답: 최신 채용 공고 목록 (임베드)
```

#### `/alarm-subscribe`
알림 설정을 구성합니다.

```
사용법: /alarm-subscribe
옵션:
  - 전체 공고 알림 (ALL)
  - 특정 지역 알림 (SELECTED)
  - 알림 켜기/끄기
```

#### `/admin-broadcast` (관리자 전용)
모든 구독자에게 공지를 발송합니다.

```
사용법: /admin-broadcast
권한: ADMIN_USER_ID 환경 변수에 등록된 관리자만
```

#### 자연어 명령
AI를 활용하여 자연어로 명령을 처리합니다.

```
예시:
  - "서울에서 단기 알바 구해줘" → 공고 조회
  - "경기도 공고만 받을래" → 알림 설정 변경
  - "알림 끄기" → 알림 비활성화
```

---

## 배포

> **E안 · 2-프로세스 토폴로지**: 봇은 **게이트웨이**(discord.js WS 로그인 + 인터랙션,
> Oracle Cloud VM + pm2, 엔트리 `lib/app/gateway.js`)와 **스케줄러**(`onSchedule` → DM
> 발송, Firebase Functions, `main` = `lib/app/scheduler.js`)로 분리 배포된다. 두 프로세스는
> 공유 Redis(Upstash) + Firestore로만 협업한다. 상세 절차·환경변수 매트릭스는
> [build-deploy.md](./.claude/docs/build-deploy.md) 참조.

### 실서비스 배포 전 체크리스트

> 코드 빌드와 로컬 테스트는 끝났다고 가정한다. 아래는 개발자가 외부 서비스 계정에서 직접 해야 하는 작업이다.
> 각 단계는 앞 단계가 끝난 뒤에 진행한다. 특히 1번을 빠뜨리면 배포는 되지만 함수가 실행될 때 실패한다.

- [ ] **1. 비밀값을 Secret Manager에 저장** 🔴 가장 먼저 — 빠뜨리면 배포된 함수가 실행 중 실패
- [ ] **2. Firebase 요금제를 Blaze(종량제)로 전환** — 정해진 시간마다 함수를 실행하려면 필요 (사용량만큼 과금)
- [ ] **3. 스케줄러 배포** — Firebase Functions
- [ ] **4. 게이트웨이(봇 상시 접속 프로세스) 실행** — Oracle Cloud VM + pm2
- [ ] **5. 슬래시 커맨드를 실서버에 등록** — 게이트웨이가 켜진 뒤 `npm run register:commands`
- [ ] **6. 구독자 확보** — 실제 Discord에서 알림 구독을 해 두어 DM을 받을 사용자를 만든다
- [ ] **7. 실환경 확인** — 슬래시 커맨드·버튼 동작 / 정해진 시간에 함수 실행 / 실제 DM 수신

### 외부 계정·리소스 설정 방법

배포에 필요한 외부 서비스는 4개다. 코드와 무관하므로 코드 작업과 동시에 준비해도 된다.

#### ① Secret Manager (비밀값 보관 서비스)

토큰·비밀번호 같은 비밀값은 `.env`가 아니라 Google Cloud Secret Manager에 저장한다.
`functions/src/app/scheduler.ts`의 `secrets` 목록에 이름이 적혀 있어서, 저장해 두면 함수가 실행될 때 `process.env`로 받는다.

```bash
cd functions
# 명령마다 값을 입력하라는 안내가 나온다. FB_PRIVATE_KEY는 줄바꿈까지 포함해 통째로 붙여 넣는다
firebase functions:secrets:set FB_PRIVATE_KEY
firebase functions:secrets:set DISCORD_BOT_TOKEN
firebase functions:secrets:set REDIS_URL

# 저장된 값 확인
firebase functions:secrets:access FB_PRIVATE_KEY
```

- 위 세 값(`FB_PRIVATE_KEY`, `DISCORD_BOT_TOKEN`, `REDIS_URL`)은 `functions/.env`에 적지 않는다. `.env`는 배포할 때 코드와 함께 올라가서 암호화되지 않은 채 남기 때문이다.
- `REDIS_URL`도 비밀값이다. 접속 주소 안에 비밀번호가 들어 있다(`rediss://default:<비밀번호>@host`).
- 노출돼도 문제없는 값(`FB_PROJECT_ID`, `FB_CLIENT_EMAIL` 등)은 `.env`에 적어도 된다.

#### ② Firebase Blaze 요금제

- Firebase Console → 프로젝트 → 요금제에서 **Blaze(종량제)**로 바꾼다. 정해진 시간마다 함수 실행(`onSchedule`)과 외부 서버 호출은 Blaze에서만 된다.
- 사용량만큼 과금되므로 예산 알림을 설정해 둔다 (GCP Billing → Budgets & alerts).

#### ③ Oracle Cloud VM (게이트웨이 실행 서버)

```bash
# Oracle Cloud Console에서 무료(Always Free) x86 Micro VM을 만든 뒤 SSH로 접속해서:
git clone <repo> && cd <repo>/functions
npm ci
npm run build

# pm2로 실행 (pm2: 프로세스가 죽거나 서버가 재부팅돼도 다시 켜 주는 도구)
pm2 start lib/app/gateway.js --name sria-gateway
pm2 startup   # 서버 부팅 시 pm2가 자동으로 켜지게 설정
pm2 save      # 지금 실행 중인 목록을 저장 → 재부팅 후 그대로 다시 실행
```

- 게이트웨이는 Discord와 WebSocket으로만 연결하므로, 외부에서 들어오는 HTTP 요청을 받을 필요가 없다. 환경변수는 VM의 `.env`에 적는다.
- 무료 VM은 리전에 따라 남은 자리가 없어 만들어지지 않을 때가 많다. 그러면 다른 리전이나 유료 소형 VM을 쓴다.

#### ④ Upstash Redis (공유 캐시)

- Upstash Console에서 Redis DB를 만들고, TLS(암호화) 접속 주소(`rediss://...`)를 복사한다. `s`가 두 개인지 확인한다.
- 게이트웨이와 스케줄러 모두 `REDIS_URL`에 같은 주소를 쓴다. 이 값은 ①에서 Secret Manager에도 저장한다.

### 스케줄러 배포 (Firebase Functions)

```bash
# 프로덕션 빌드
npm run build

# Firebase 배포 (recruitSchedule_sria / recruitSchedule_temp 스케줄 트리거만 배포)
npm run deploy
```

### 게이트웨이 배포 (Oracle Cloud VM + pm2)

```bash
npm run build
pm2 start lib/app/gateway.js --name sria-gateway
pm2 startup && pm2 save   # 재부팅 시 자동 부활
```

### 환경변수·비밀값 설정

비밀값은 위 **① Secret Manager** 절차로 저장한다. 노출돼도 문제없는 값(`FB_PROJECT_ID`, `FB_CLIENT_EMAIL` 등)은 `functions/.env` 또는 VM의 `.env`에 적는다.

> ⚠️ 예전 방식인 `firebase functions:config:set`은 쓰지 않는다. Firebase가 폐기 예정으로 지정했고, 이 프로젝트가 쓰는 2세대 Functions에서는 동작하지 않는다.

---

## 브랜치 전략

```
dev (개발) → stable (검수) → main (배포)
```

| 브랜치 | 역할 | 설명 |
|--------|------|------|
| `dev` | 개발 | 기능 개발 및 Claude 관련 문서 포함 |
| `stable` | 검수 | Claude 관련 파일 제외, 최종 검수 |
| `main` | 배포 | 프로덕션 배포 버전 |

- 단방향 flow: `dev → stable → main` (역방향 pull 금지)
- `stable`의 `.gitattributes`에서 Claude 관련 파일 merge 시 자동 제외

---

## 기여하기

이 프로젝트는 개인 프로젝트로 현재 외부 기여를 받고 있지 않습니다.

버그 리포트나 기능 제안은 [Issues](https://github.com/your-org/sria-notify-discord/issues)에 등록해 주세요.

---

## 문서

### 프로젝트 문서
- [개발 진행 현황](./.claude/todo/PROGRESS.md) - 현재 Phase 진행 상황
- [TODO 관리](./.claude/todo/TODO.md) - Phase별 작업 목록
- [Phase 1 상세 계획](./.claude/todo/phase-1-core.md)
- [검토 프로세스](./.claude/todo/review/REVIEW_PROCESS.md)

### 기술 문서
- [EventBus 시스템](./functions/src/eventBus/claude.md)
- [SystemLogger 가이드](./functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)
- [SystemError 가이드](./functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)

### API 문서
- [Firebase Functions API](https://firebase.google.com/docs/functions)
- [Discord.js Guide](https://discordjs.guide/)

---

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

## 문의

프로젝트 관련 문의사항은 [Issues](https://github.com/your-org/sria-notify-discord/issues)를 통해 남겨주세요.

---

<div align="center">

**Made with ❤️ using Firebase Functions and Discord.js**

</div>

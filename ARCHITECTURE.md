# 아키텍처 개요

> 사람인 에이전트 Discord Bot - Event-Driven Architecture
>
> **최종 수정**: 2026-01-11

---

## 📐 시스템 아키텍처

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Firebase Functions                        │
│                  (asia-northeast3)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   HTTP       │  │   Discord    │  │  Schedulers  │     │
│  │   Express    │  │   Events     │  │  4h / 6h     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                          │                                  │
│         ┌────────────────┴────────────────┐                │
│         │        EventBus (Core)          │                │
│         │    Node.js EventEmitter         │                │
│         └────────────────┬────────────────┘                │
│                          │                                  │
│    ┌─────────────────────┼─────────────────────┐           │
│    │                     │                     │           │
│    ▼                     ▼                     ▼           │
│ ┌────────┐         ┌──────────┐         ┌─────────┐       │
│ │Services│         │ Features │         │Providers│       │
│ └────────┘         └──────────┘         └─────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   ┌────────┐      ┌──────────┐      ┌──────────┐
   │Discord │      │Firestore │      │  Redis   │
   │  API   │      │          │      │          │
   └────────┘      └──────────┘      └──────────┘
```

---

## 🏗️ 계층 구조 (Layered Architecture)

### 1. Presentation Layer (events/)

**역할**: 외부 요청을 받아 적절한 핸들러로 라우팅

```
events/
├── interactionCreate/     # Discord 상호작용 이벤트
│   ├── commandHandler.ts  # Slash Command 처리
│   ├── buttonHandler.ts   # 버튼 클릭 처리
│   └── modalHandler.ts    # 모달 제출 처리
└── ready/
    └── readyHandler.ts    # Bot 준비 완료
```

**책임**:
- Discord 이벤트 수신
- 요청 검증
- 적절한 Feature로 위임

---

### 2. Application Layer

#### EventBus (eventBus/)

**역할**: 비즈니스 이벤트의 중앙 허브

```typescript
// Singleton Pattern
export class EventBus extends EventEmitter {
  private static instance: EventBus;

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
      this.instance.setMaxListeners(100);
    }
    return this.instance;
  }

  // 타입 안전 메서드
  emitEvent<T extends EventType>(event: T, payload: EventPayloadMap[T]): boolean {
    return this.emit(event, payload);
  }

  onEvent<T extends EventType>(event: T, handler: EventHandler<T>): this {
    return this.on(event, handler);
  }
}
```

**이벤트 도메인**:
- **Recruit**: 크롤링, 새 공고, 공고 요청
- **Notification**: 구독, 알림 발송
- **System**: 에러 처리 및 로깅
- **Admin**: 관리자 기능
- **Proxy**: 프록시 순환

**참고**: [functions/src/eventBus/claude.md](./functions/src/eventBus/claude.md)

#### Services (services/)

**역할**: 핵심 비즈니스 로직

```
services/
├── recruitService.ts          # 공고 조회 로직
├── recruitCacheService.ts     # 공고 캐싱 및 변경 감지
├── notificationService.ts     # 알림 발송 로직
├── errorReportService.ts      # 에러 리포팅
└── aiService.ts               # AI 자연어 처리
```

#### Features (features/)

**역할**: 사용자 기능 모듈 (독립적)

```
features/
├── alarmSubscribe/       # 알림 설정 기능
├── recruitRequest/       # 공고 요청 기능
├── notification/         # 알림 발송 기능
├── errorReporting/       # 에러 리포팅 기능
└── adminBroadcast/       # 관리자 공지 기능
```

**Feature 내부 구조**:
```
alarmSubscribe/
├── commands/            # Slash Command 정의
├── interactions/        # UI 컴포넌트 (버튼, 모달)
├── handlers/            # 이벤트 핸들러
├── services/            # Feature별 비즈니스 로직
└── types/               # 타입 정의
```

---

### 3. Integration Layer

#### Providers (providers/)

**역할**: 외부 서비스 통합

```
providers/
├── discord/
│   └── utils/
│       └── dmSender.ts          # Discord DM 발송
│
├── firebase/
│   └── store/
│       ├── subscription.ts      # 알림 설정 저장소
│       ├── errorLog.ts          # 에러 로그 저장소
│       ├── broadcast.ts         # 공지 이력 저장소
│       └── aiCache.ts           # AI 캐시 저장소
│
└── ai/
    └── huggingface/
        ├── client.ts            # HF API 클라이언트
        ├── models.ts            # 모델 설정
        └── rateLimiter.ts       # Rate Limit 관리
```

#### Crawlers (crawlers/)

**역할**: 웹 크롤링 및 스케줄링

```
crawlers/
├── schedulers/
│   ├── base/
│   │   └── BaseScheduler.ts     # 스케줄러 기본 클래스
│   ├── RecruitScheduler.ts      # 공고 크롤링 (4시간)
│   └── ProxyScheduler.ts        # 프록시 갱신 (6시간)
│
└── recruit/
    └── RecruitCrawler.ts        # Playwright 크롤러
```

---

## 🔄 Event-Driven Architecture

### 이벤트 흐름

```
[Trigger]
   │
   ├─ Discord Command (/recruit-request)
   ├─ Discord Interaction (버튼 클릭)
   └─ Scheduler (4시간 주기)
   │
   ▼
[Presentation Layer]
   events/interactionCreate/commandHandler.ts
   │
   ▼
[Application Layer]
   features/recruitRequest/handlers/commandHandler.ts
   │
   ├─ services/recruitService.getRecruitList()
   │  │
   │  └─ Redis → Firestore → Crawling (3-tier)
   │
   └─ eventBus.emit('recruit.requested', data)

[Event Subscribers]
   └─ services/notificationService (recruit.new 구독)
      │
      └─ providers/discord/utils/dmSender
         │
         └─ Discord DM 발송
```

### 이벤트 목록

**도메인별 이벤트**:
- **Recruit**: 크롤링 시작/완료/실패, 새 공고, 공고 요청
- **Notification**: 구독/구독해제, 알림 발송 시작/완료
- **System**: Critical/Failure/Warning 에러
- **Admin**: 전체 공지 요청/완료
- **Proxy**: 프록시 순환 성공/실패

---

## 🗄️ 데이터 흐름

### 3-Tier Caching Strategy

```
User Request
    │
    ▼
┌─────────────────┐
│  Redis Cache    │ ← 1st: 5분 TTL
│  (In-Memory)    │
└─────────────────┘
    │ (Cache Miss)
    ▼
┌─────────────────┐
│ Firestore Cache │ ← 2nd: 30분 TTL
│  (Document DB)  │
└─────────────────┘
    │ (Cache Miss)
    ▼
┌─────────────────┐
│  Web Crawling   │ ← 3rd: Playwright
│  (Playwright)   │
└─────────────────┘
```

### 공고 변경 감지 (SHA-256)

```typescript
// recruitCacheService.ts
export class RecruitCacheService {
  async setRecruitList(recruits: Job[]): Promise<CacheStatus> {
    const currentHash = this.calculateHash(recruits);
    const previousHash = await this.getPreviousHash();

    if (currentHash === previousHash) {
      return 'UNCHANGED';
    }

    const { addedJobs, updatedJobs, deletedIds } = this.diffJobs(
      previousRecruits,
      recruits
    );

    // 이벤트 발행
    eventBus.emit('recruit.new', {
      addedJobs,
      updatedJobs,
      deletedIds
    });

    return 'CHANGED';
  }
}
```

---

## 🔐 Firestore 스키마

### users 컬렉션
```
users/{userId}/
└── notifications/
    └── settings/
        {
          enabled: boolean,
          alertMode: 'ALL' | 'SELECTED',
          regions: string[],
          createdAt: Timestamp,
          updatedAt: Timestamp
        }
```

### errors 컬렉션
```
errors/{errorId}/
{
  type: string,
  message: string,
  stack: string,
  service: string,
  createdAt: Timestamp,
  resolved: boolean
}
```

### broadcasts 컬렉션
```
broadcasts/{broadcastId}/
{
  content: string,
  author: string,
  targetCount: number,
  successCount: number,
  failureCount: number,
  createdAt: Timestamp
}
```

### ai_nlp_cache 컬렉션
```
ai_nlp_cache/{cacheId}/
{
  message: string,
  intent: {
    action: 'recruit' | 'subscribe' | 'unsubscribe',
    region?: string,
    regions?: string[]
  },
  createdAt: Timestamp,
  expiresAt: Timestamp  // 7일 TTL
}
```

---

## 🚀 배포 아키텍처

### Firebase Functions 구성

```yaml
functions:
  - name: app
    runtime: nodejs18
    region: asia-northeast3
    memory: 512MB
    timeout: 540s

    triggers:
      - http  # Express 앱

    environment:
      DISCORD_BOT_TOKEN: ${DISCORD_BOT_TOKEN}
      REDIS_URL: ${REDIS_URL}
      HUGGINGFACE_API_KEY: ${HUGGINGFACE_API_KEY}
```

### 스케줄러 설정

```typescript
// Cloud Scheduler (Cron)
RecruitScheduler:
  schedule: "0 */4 * * *"  // 4시간마다

ProxyScheduler:
  schedule: "0 */6 * * *"  // 6시간마다
```

---

---

## 🔗 관련 문서

### 프로젝트 문서
- [README.md](./README.md) - 프로젝트 개요
- [PROGRESS.md](./.claude/todo/PROGRESS.md) - 개발 진행 현황
- [TODO.md](./.claude/todo/TODO.md) - Phase별 작업 목록
- [phase-1-core.md](./.claude/todo/phase-1-core.md) - Phase 1 상세 계획

### 기술 문서
- [EventBus 시스템](./functions/src/eventBus/claude.md)
- [SystemLogger 가이드](./functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)
- [SystemError 가이드](./functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)

### 검토 문서
- [REVIEW_PROCESS.md](./.claude/todo/review/REVIEW_PROCESS.md) - 검토 프로세스
- [phase-1-1-review.md](./.claude/todo/review/phase-1-1-review.md) - Phase 1.1 검토

### 외부 문서
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Discord.js Guide](https://discordjs.guide/)

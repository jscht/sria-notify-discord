# 아키텍처 개요

> 사람인 에이전트 Discord Bot - Event-Driven Architecture

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
    }
    return this.instance;
  }
}
```

**주요 이벤트 도메인**:
- `recruit.*` - 공고 관련 이벤트
- `notification.*` - 알림 관련 이벤트
- `error.*` - 에러 관련 이벤트
- `admin.*` - 관리자 기능 이벤트

#### Services (services/)

**역할**: 핵심 비즈니스 로직

```
services/
├── recruitService.ts          # 공고 조회 로직
├── recruitCacheService.ts     # 공고 캐싱 및 변경 감지
├── notificationService.ts     # 알림 발송 로직
├── errorReportService.ts      # 에러 리포팅
└── aiService.ts               # AI 자연어 처리 (Phase 4)
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

### 주요 이벤트 목록

#### Recruit Domain
```typescript
'recruit.crawl.started'     // 크롤링 시작
'recruit.crawl.completed'   // 크롤링 완료
'recruit.crawl.failed'      // 크롤링 실패
'recruit.new'               // 새 공고 발견
'recruit.requested'         // 사용자 공고 요청
```

#### Notification Domain
```typescript
'notification.subscribe'    // 알림 구독
'notification.unsubscribe'  // 알림 구독 해제
'notification.send'         // 알림 발송 시작
'notification.sent'         // 알림 발송 완료
```

#### Error Domain
```typescript
'error.critical'            // 심각한 에러
'error.warning'             // 경고
```

#### Admin Domain
```typescript
'admin.broadcast.request'   // 전체 공지 요청
'admin.broadcast.sent'      // 전체 공지 완료
```

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

### errors 컬렉션 (Phase 2.1)
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

### broadcasts 컬렉션 (Phase 2.2)
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

### ai_nlp_cache 컬렉션 (Phase 4.2)
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

## 📊 Phase별 구현 계획

### Phase 1: 핵심 기능
- EventBus 인프라
- 스케줄러 이벤트 전환
- 공고 캐싱 및 변경 감지
- 알림 설정 시스템
- 자동 알림 발송

### Phase 2: 부가 기능
- 에러 자동 리포팅
- 관리자 전체 공지
- AI 자연어 처리

### Phase 3: 테스트 및 안정화
- 테스트 프레임워크
- 단위/통합 테스트
- 성능 테스트

---

## 🔗 관련 문서

- [README.md](./README.md) - 프로젝트 개요
- [TODO.md](./functions/TODO.md) - 구현 작업 목록
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Discord.js Guide](https://discordjs.guide/)

---

*최종 수정: 2026-01-06*

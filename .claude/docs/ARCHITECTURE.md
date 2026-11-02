# 아키텍처 개요

> 사람인 에이전트 Discord Bot - Event-Driven Architecture

---

## 시스템 아키텍처

### High-Level Overview

```mermaid
graph TD
    subgraph Firebase Functions - asia-northeast3
        HTTP[HTTP Express] --> EventBus[EventBus Core - Node.js EventEmitter]
        Discord[Discord Events] --> EventBus
        Schedulers[Schedulers 사이트 갱신/알림] --> EventBus
        EventBus --> Services
        EventBus --> Features
        EventBus --> Providers
    end
    Services --> DiscordAPI[Discord API]
    Services --> Firestore
    Services --> Redis
```

---

## 계층 구조 (Layered Architecture)

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

**역할**: 비즈니스 이벤트의 중앙 허브 (Singleton, Node.js EventEmitter 기반)

**이벤트 도메인**:
- **Recruit**: 크롤링, 새 공고, 공고 요청
- **Notification**: 구독, 알림 발송
- **System**: 에러 처리 및 로깅
- **Admin**: 관리자 기능
- **Proxy**: 프록시 순환

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

## Event-Driven Architecture

### 이벤트 흐름

```mermaid
graph TD
    T1[Discord Command] --> PL[Presentation Layer - commandHandler.ts]
    T2[Discord Interaction] --> PL
    PL --> AL[Application Layer - recruitRequest handler]
    AL --> RS[recruitService.getRecruitList]
    RS --> Cache[Redis → 사이트 갱신 → Firestore 3-tier]
    T3[사이트 갱신 스케줄러] --> Sync[recruitService.syncRecruits]
    T4[알림 스케줄러] --> RN[notificationService.runNotification]
    RN --> Sync
    RN --> EB[eventBus NOTIFICATION_SEND]
    EB --> NH[NotificationSendHandler]
    NH --> DM[Discord DM 발송]
```

### 이벤트 목록

**도메인별 이벤트**:
- **Recruit**: 크롤링 시작/완료/실패, 새 공고, 공고 요청
- **Notification**: 구독/구독해제, 알림 발송 시작/완료
- **System**: Critical/Failure/Warning 에러
- **Admin**: 전체 공지 요청/완료
- **Proxy**: 프록시 순환 성공/실패

---

## 데이터 흐름

### 3-Tier Caching Strategy

공고 조회(`recruitService.getRecruitList`)는 아래 순서로 읽는다.

```mermaid
graph TD
    Req[User Request] -->|1st| Redis[Redis 최신 공고 목록 - 6시간 만료, 갱신마다 연장]
    Redis -->|비어 있음| Sync[사이트 갱신 - syncRecruits]
    Sync -->|갱신 뒤에도 비어 있음| FS[Firestore 공고 목록 - 읽기만]
```

- Redis 최신 공고 목록에 쓰는 곳은 `syncRecruits` 하나다. 사이트 락과 사이트별 비교를 모든 경로가 똑같이 따르게 하기 위해서다.
- Firestore 목록은 보여 주기만 하고 Redis에 쓰지 않는다. 오래된 목록이 Redis에 섞이지 않게 하기 위해서다.
- Firestore 공고 목록은 알림 실행이 저장한다. 사이트 갱신은 갱신 시각만 저장한다.

### 공고 변경 감지

SHA-256 해시 비교로 사이트별 공고 변경을 감지한 뒤 `RECRUIT_CHANGED`를 발행한다. 이 이벤트를 구독하는 핸들러는 없고, DM은 아래 알림 흐름이 보낸다.

### 알림 흐름

사이트 갱신과 알림은 따로 돈다. 사이트 갱신은 공고 조회가 최신 목록을 읽도록 밤에도 돌고, 알림은 낮 시간에만 돈다. 작업 목록은 `schedulers/jobs.ts`의 `SCHEDULED_JOBS` 한 곳이다.

| 작업 | 일정 (한국 시간) | 하는 일 |
|------|------------------|---------|
| `recruitSchedule_sria` | 2시간마다 | sria 공고 갱신 |
| `recruitSchedule_elias` | 30분마다 | elias 공고 갱신 |
| `notificationScheduler` | 매일 06~20시 짝수 정시 | 사이트 갱신 뒤 구독자별 판정과 발송 |

알림 1회의 순서:

1. 알림 락을 잡고 사이트마다 갱신한다. 최근 5분 안에 갱신했으면 건너뛰고, 진행 중인 갱신은 기다린다.
2. 최신 공고 목록을 지난 알림 때 목록과 비교해 새 공고와 내용이 바뀐 공고를 찾는다.
3. 구독자별로 판정해 `NOTIFICATION_SEND`를 발행한다. 숨긴 사이트를 빼고 정렬한 뒤 구독자의 `sources`·`regions`로 거르고, 바뀐 공고가 있는 구독자에게 조건에 맞는 공고 전체를 보낸다.
4. 발송이 끝난 뒤 지난 알림 때 목록과 Firestore 공고 목록을 저장한다. 발송 중 멈추면 다음 알림이 다시 보낸다.

| Redis 키 | 용도 | 만료 |
|----------|------|------|
| `recruit:notified:all` | 지난 알림 때 목록 (공고 ID → 비교값) | 없음 |
| `recruit:lastSync:{source}` | 사이트별 마지막 갱신 성공 시각 | 1일 |
| `lock:notification` | 알림 락 | 5분 |

### Firestore 컬렉션

- **users/{userId}/notifications/settings** — 알림 설정 (켜짐 여부, 지역, 사이트)
- **errors/{errorId}** — 에러 로그
- **broadcasts/{broadcastId}** — 공지 이력
- **ai_nlp_cache/{cacheId}** — AI 의도 분석 캐시 (7일 TTL)

---

## 관련 문서

- [SystemLogger 가이드](./functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)
- [SystemError 가이드](./functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)

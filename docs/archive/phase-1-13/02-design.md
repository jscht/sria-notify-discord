# Phase 1.13 설계서: 프로덕션 런타임 & 스케줄러 트리거 재설계

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-13/01-plan.md`
**작성자**: Integration Lead (primary) + Discord Agent (co-author, §2.5 dmSender REST)

---

## 1. 아키텍처 설계

### 1.0 런타임 결정 — C안 하이브리드 (고정)

Phase 1.13은 배포 런타임을 **두 프로세스로 분리하는 C안 하이브리드**로 고정한다.
이 결정이 #2(onSchedule)·#4(틱 완결)·#5(crawlAndDiff)를 강결합으로 지배하므로,
본 §1이 `do` 진입 게이트다(plan 리스크 표 R1).

| 프로세스 | 역할 | 열리는 것 | 안 열리는 것 |
|----------|------|-----------|--------------|
| ① Gateway (상시·slim) | 인터랙션 수신(슬래시/버튼/모달/셀렉트) | discord.js Client WebSocket 로그인, `onInteraction` 리스너, ready 빗장, Firebase, Redis | 스케줄러 (미시작) |
| ② Serverless 함수 (scale-to-zero) | onSchedule 크롤 → diff → 알림 | Firebase, Redis, Discord **REST**(로그인 없음), `onSchedule` 트리거 | gateway WebSocket, ready 대기 |

**트레이드오프 / 비용 / 계약 영향** (plan 요구 §1):

- **인터랙션 = gateway 유지 (재작성 0)**: HTTP Interactions 전환에 따르는 Ed25519 서명검증·3초 응답 창·cold start UX 리스크를 회피한다. `onInteraction.ts`/`discordListeners.ts` **무변경**이 계약이다.
- **크롤·알림 = serverless**: Playwright 크롤을 온디맨드로 격리하고 scale-to-zero로 상시 크롤 비용을 없앤다. 대가로 **서버리스 CPU 동결**이 발생하므로, 한 tick이 CPU 동결 전에 크롤→diff→DM(REST)까지 **await로 완결**되어야 한다(§2.3).
- **비용**: gateway는 상시 프로세스(Cloud Run min-instance)라 상시 비용이 있으나 인터랙션 수신 전용 slim 프로세스로 최소화한다. 실제 인프라 프로비저닝·실배포는 **Phase 1.10 이월**.
- **순차 발송 블로킹 비용**: 틱 완결 파이프라인이 구독자별 DM을 순차 await하는 블로킹 비용은 **인지만** 하고 실측은 1.10 E2E로 이월한다(plan 비기능 요구).

### 1.1 EventBus 계약 — 프로세스-로컬화 (필수 문장화)

`EventBus`는 프로세스별 Singleton(`EventBus.getInstance()`)이다. C안이 런타임을 **두 개의 독립 Node 프로세스**로 쪼개므로, 각 프로세스는 **서로 다른 EventBus 인스턴스**를 갖는다 — 즉 EventBus가 자연히 **프로세스-로컬화**된다. 이 사실을 계약으로 문장화한다:

- **Gateway 프로세스 = EventBus #1**: 인터랙션 유발 이벤트(예: `RECRUIT_REQUESTED`, `NOTIFICATION_SUBSCRIBE`)가 이 프로세스의 EventBus에만 존재한다.
- **함수 프로세스 = EventBus #2**: 스케줄러 tick의 `RECRUIT_NEW → NOTIFICATION_SEND → NOTIFICATION_SENT` 체인이 이 프로세스의 EventBus에만 존재한다.
- **인트라-프로세스(크롤 → DM) = EventBus 유지**: 함수 프로세스 안에서 크롤부터 DM 발송까지는 전부 EventBus #2 안에서 완결된다(§2.3). 크로스-프로세스 배선이 **필요 없다** — 1.13의 핵심 파이프라인은 단일 함수 프로세스 내부에서 닫힌다.
- **크로스-프로세스 이벤트 = Firestore 트리거(DB-as-bus) 방침**: 한 프로세스의 이벤트를 다른 프로세스가 소비해야 하는 경우(예: gateway 인터랙션이 즉시 크롤을 유발, 또는 함수 결과를 gateway가 관찰)는 EventBus로 넘길 수 없다(인스턴스가 분리됨). 이때는 **Firestore 트리거(DB-as-bus)**로 간다 — "기록 저장 = 발행" 방침(2.1 에러 로그 저장)과 정합한다.
- **스코프 경계**: 위 크로스-프로세스 배선(Firestore 트리거)의 **실제 구현은 Phase 2.1/2.2로 이월**한다. 1.13은 이 방침을 **계약으로 명시만** 하고, 실제 트리거·리스너 코드는 작성하지 않는다.

### 1.2 계약 불변 (필수 명시)

1.13 전 과정에서 아래 세 계약은 **불변**이며 analyze Contract 차원 필수 검증 대상이다:

- **`DmPayload` / `DmSendResult` 불변**: dmSender REST 전환(§2.5)은 계약 외 내부 변경으로만 수행한다. 시그니처·필드 무변경(1.9/1.10/2.1/2.2 공유 계약).
- **`getRecruitList` 3-tier 무회귀**: `crawlAndDiff`는 `getRecruitList`를 우회하는 **별도 경로**다. `getRecruitList` 본문은 수정하지 않는다(§2.4).
- **인터랙션 수신 코드 무변경**: `onInteraction.ts`, `discordListeners.ts`는 손대지 않는다(§1.0).

### 1.3 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| App 진입점 (`functions/src/app/`) | **진입점 분리** — `index.ts`=gateway 부트스트랩(스케줄러 미시작), `scheduler.ts`(신규)=함수 부트스트랩 + `onSchedule` 트리거 (§2.1) |
| Providers (`functions/src/providers/`) | ① provider 번들 분리(`initGatewayProviders`/`initFunctionProviders`) — 배선 소유(§2.1). ② `discord/` REST 분리·dmSender REST — **Discord Agent 소유**(§2.5) |
| Crawlers/Schedulers (`functions/src/crawlers/schedulers/`) | `BaseScheduler` setTimeout 루프 → `runOnce()` 추출(awaitable 단일 tick), `onSchedule`가 호출. `RecruitScheduler.performWork`가 `getRecruitList` → `crawlAndDiff` 전환 (§2.2) |
| Services (`functions/src/services/`) | `RecruitService.crawlAndDiff(mode)` 신설(스케줄러 전용). `RecruitCacheService.setRecruitList` 반환값 확장 + emit 추출. `notificationService`가 awaitable 발행로 전환 (§2.3, §2.4) |
| Events (`functions/src/events/`) | 인터랙션 수신(`onInteraction`/`discordListeners`) **무변경**. 핸들러 등록(`registerAllEventHandlers`)은 두 프로세스가 각자 호출 (§2.1) |
| EventBus (`functions/src/events/bus/`) | **additive**: `emitEventAndSettle`(리스너 promise 수집·await) 추가. 기존 `emitEvent` 불변 (§2.3) |
| Common (`functions/src/common/`) | 공용 emit 헬퍼(`emitRecruitNewEvent`) 위치 후보 — 두 발행부(user path·crawlAndDiff)가 CHANGED gating 공유 (§2.4) |

### 1.4 컴포넌트 다이어그램

```
① Gateway 프로세스 (상시·slim)              ② Serverless 함수 (scale-to-zero)
┌──────────────────────────────┐          ┌───────────────────────────────────────┐
│ app/index.ts                 │          │ app/scheduler.ts (신규)               │
│  initGatewayProviders()      │          │  initFunctionProviders()              │
│   ├─ Firebase                │          │   ├─ Firebase                         │
│   ├─ Redis                   │          │   ├─ Redis                            │
│   └─ Discord Gateway(WS+ready)│          │   └─ Discord REST (로그인·ready 없음) │
│  registerAllEventHandlers()  │          │  registerAllEventHandlers()           │
│  onInteraction (무변경)      │          │  onSchedule(4h) → scheduler.runOnce() │
│                              │          │    └─ crawlAndDiff(mode)              │
│  EventBus #1 (프로세스 로컬) │          │       ├─ 강제 크롤                    │
└──────────────────────────────┘          │       ├─ setRecruitList (hash diff)   │
              │                            │       └─ await emitEventAndSettle      │
              │                            │            RECRUIT_NEW                 │
              │                            │             → NOTIFICATION_SEND        │
              │                            │              → dmSender(REST)          │
              │                            │               → NOTIFICATION_SENT      │
              │                            │  EventBus #2 (프로세스 로컬)          │
              │                            └───────────────────────────────────────┘
              │                                        ▲
              └────────► ③ Firestore 트리거 ◄──────────┘
                         (크로스-프로세스만 · 방침만 명시 · 배선 2.1/2.2 이월)
```

---

## 2. 상세 설계

### 2.1 진입점 분리 (gateway / 함수 부트스트랩)

**파일**: `functions/src/app/index.ts`(수정 = gateway), `functions/src/app/scheduler.ts`(신규 = 함수), `functions/src/providers/index.ts`(수정 = 번들 분리)

**문제**: 현재 `app/index.ts`가 단일 부트스트랩으로 provider init + `registerAllEventHandlers` + `initializeSchedulers`(setTimeout) + express를 모두 eager 실행한다(`app/index.ts:24-38`). C안은 프로세스가 둘로 갈리므로 각 프로세스가 **필요한 것만** init해야 한다.

**provider 번들 분리** — 현재 `initializeProviders()`는 `Promise.all([initFirebaseApp, initRedis, initDiscordBot])`를 묶는다(`providers/index.ts:13-17`). 이를 프로세스별 번들로 쪼갠다:

**타입/시그니처 정의**:
```typescript
// providers/index.ts
export function initGatewayProviders(): Promise<void>;  // Firebase + Redis + initDiscordBot(gateway WS+login+ready 빗장)
export function initFunctionProviders(): Promise<void>; // Firebase + Redis + initDiscordRest(REST만·login/ready 없음)
```

- `initGatewayProviders`: 기존 `initializeProviders`와 동일한 3종(Firebase/Redis/`initDiscordBot`). gateway는 인터랙션 핸들러가 서비스(Redis/Firestore)를 호출하므로 셋 다 필요하며, ready 빗장은 **인터랙션 UX용으로 유지**한다.
- `initFunctionProviders`: Firebase + Redis + **REST 전용 Discord init**. gateway WebSocket을 열지 않고 `client.login()`을 호출하지 않으며 ready 빗장을 **대기하지 않는다**. REST 클라이언트 분리(`initDiscordRest`)는 **Discord Agent 소유**(§2.5) — 본 배선은 그 함수를 호출하는 지점만 정의한다.
- 두 번들 모두 메모이즈 패턴(`initPromise`)을 유지해 중복 실행을 막는다.

**client.ts 경계 (CTO 확정)**: "`discord/` 디렉토리 안"(REST 클라이언트 분리·`dmSender`·`getDiscordReady` 제거)은 **Discord Agent 소유**다. "누가 언제 호출하느냐(부트스트랩 배선)"만 Integration Lead가 소유한다 → 본 §2.1은 **gateway 프로세스는 인터랙션용 ready 빗장을 유지 / 함수 프로세스는 ready를 대기하지 않는다**는 호출 계약만 확정한다.

> **`getDiscordReady` 제거 범위 (오독 방지)**: 여기서 "제거"는 **dmSender 호출부의 `await getDiscordReady()` 삭제만** 뜻한다. `discordReady` 모듈과 `markDiscordReady`는 **gateway 프로세스에 그대로 존치**한다(인터랙션 UX용 ready 빗장). 즉 dmSender만 ready를 기다리지 않을 뿐, gateway의 ready 게이트 자체는 유지된다.

**gateway 부트스트랩** (`app/index.ts`):
```typescript
// pseudo — 스케줄러 시작 제거가 핵심
registerGlobalErrorHandlers();
initGatewayProviders()
  .then(() => {
    registerAllEventHandlers();   // EventBus #1 핸들러 등록
    // ❌ initializeSchedulers 제거 — gateway는 스케줄러를 시작하지 않는다.
  })
  .catch((e) => globalLogger.error("gateway bootstrap failed:", e));
const expressApp = initExpress();
const appServer = firebaseDeploy(expressApp);
```

**함수 부트스트랩** (`app/scheduler.ts`, 신규):
```typescript
// pseudo
registerGlobalErrorHandlers();
const ready = initFunctionProviders().then(() => registerAllEventHandlers()); // EventBus #2 핸들러 등록

// 프로덕션 트리거 (코드만 — 실발화·실배포는 1.10)
export const recruitSchedule = onSchedule("every 4 hours", async () => {
  await ready;
  await SchedulerManager.getInstance().runRecruitOnce(CRAWL_MODE.CRAWL); // §2.2
});

// 로컬 DUMMY E2E (1.9 auto-E2E 대체) — env 게이팅
if (process.env.RUN_SCHEDULER_ONCE === "true") {
  ready.then(() => SchedulerManager.getInstance().runRecruitOnce(CRAWL_MODE.DUMMY));
}
```

- 1.9는 gateway 부트스트랩에서 DUMMY 스케줄러를 eager 시작해 "첫 크롤 = auto E2E"였다. 이제 스케줄러가 gateway에서 사라지므로, **함수 부트스트랩의 env 게이팅 1회 invoke**가 그 역할을 대체한다.
- `onSchedule`는 firebase-functions v2 `onSchedule`(Cloud Scheduler)로 정의한다. **실제 발화·실 CRAWL·실배포는 Phase 1.10 이월**(코드/정적만).

**에러 처리**: 두 부트스트랩 모두 `registerGlobalErrorHandlers()`를 **가장 먼저** 등록(init 중 미처리 rejection 포획). init 실패는 흡수·로깅하되 프로세스 목적별로 분기(gateway는 HTTP를 막지 않음, 함수는 tick 실패를 `RECRUIT_CRAWL_FAILED`로 발행).

### 2.2 onSchedule 전환 (setTimeout 루프 → 단일 tick)

**파일**: `functions/src/crawlers/schedulers/base/BaseScheduler.ts`(수정), `RecruitScheduler.ts`(수정), `SchedulerManager.ts`(수정)

**문제**: `BaseScheduler`가 in-process `setTimeout` 자기-재스케줄 루프(`BaseScheduler.ts:119-121`)로 cadence를 소유한다. 서버리스에서는 응답 후 CPU가 동결되어 4시간 타이머가 발화하지 않는다. cadence를 **Cloud Scheduler(onSchedule)**로 넘기고, `BaseScheduler`는 **단일 tick**만 책임진다.

**핵심 로직 (factoring)**:
```typescript
// BaseScheduler — 단일 tick을 awaitable로 추출
abstract class BaseScheduler {
  // STARTED emit → performWork() → COMPLETED/FAILED emit. 다음 tick 재스케줄 없음.
  async runOnce(): Promise<WorkResult>;

  // 로컬 장기 실행 전용: runOnce()를 setTimeout으로 감싸 루프. 프로덕션 미사용.
  startWork(): void;  // 내부적으로 runOnce() 호출 후 scheduleNextExecution()
}
```

- 기존 `scheduleNextWork()`의 STARTED/COMPLETED/FAILED 이벤트 발행 + `performWork()` 호출부를 **`runOnce()`로 이동**하고, **결과를 반환**한다(awaitable). `runOnce()`는 `scheduleNextExecution()`을 **호출하지 않는다** — 이것이 "setTimeout 루프 격리"다.
- `startWork()`(로컬 장기 실행)는 `runOnce()` → `scheduleNextExecution()`(setTimeout으로 다시 `runOnce`) 형태로 남겨 로컬 개발 cadence를 보존한다. 프로덕션 함수 프로세스는 `startWork()`를 쓰지 않고 `onSchedule`가 매 tick `runOnce()`를 await한다.
- `SchedulerManager`에 `runRecruitOnce(mode)` 추가 — RecruitScheduler 인스턴스를 얻어 `runOnce()`를 await 반환(onSchedule/로컬 게이팅이 호출).

**RecruitScheduler.performWork 전환**:
```typescript
// AS-IS: getRecruitList가 3-tier 캐시에 걸려 Step4 크롤에 도달하지 못함
// const { data } = await this.recruitService.getRecruitList(this.mode);
// TO-BE: 스케줄러 전용 crawlAndDiff (3-tier 우회·강제 크롤)
const diff = await this.recruitService.crawlAndDiff(this.mode);  // §2.4
```

**에러 처리**: `runOnce()`는 `performWork` 실패 시 `RECRUIT_CRAWL_FAILED` 이벤트를 발행하고 결과를 반환한다(현행 발행 계약 유지). `onSchedule` 래퍼는 실패를 흡수·로깅해 Cloud Scheduler 재시도 정책에 위임한다(실제 재시도 검증은 1.10).

### 2.3 틱 완결 파이프라인 (awaitable emit)

**파일**: `functions/src/events/bus/EventBus.ts`(additive), `services/notificationService.ts`(수정), 공용 emit 헬퍼

**문제 (핵심)**: 현재 파이프라인은 **전 구간 fire-and-forget**이다. `setRecruitList`가 `eventBus.emitEvent(RECRUIT_NEW)`를 **동기 emit**하고(핸들러 promise를 버림), `notifyNewRecruits`가 구독자별 `NOTIFICATION_SEND`를 다시 fire-and-forget emit하며, `NotificationSendHandler`가 `sendNotificationDM`을 await하지만 그 promise도 emitter에서 분리(detached)된다. Node `EventEmitter.emit`은 async 리스너를 **떼어내 실행**하고 즉시 반환하므로, 서버리스 tick이 `crawlAndDiff` 반환 직후 종료되면 **in-flight DM 발송이 잘린다**. 장기 실행 프로세스에서는 이벤트 루프가 나중에 drain하므로 문제없지만 scale-to-zero와 비호환이다.

**설계 — awaitable emit (additive)**:
```typescript
// EventBus.ts — 기존 emitEvent 불변, 신규 메서드 추가
emitEventAndSettle<T>(event: EventType, payload: T): Promise<void>;
// 내부: this.listeners(event)를 순회해 각 리스너를 payload로 호출,
// 반환된 값(promise 가능)을 모아 await Promise.allSettled(...)
```

- **두 hop 모두** awaitable로 전파해야 tick이 DM 완결까지 await한다:
  - Hop1 `RECRUIT_NEW`: crawlAndDiff가 `await emitEventAndSettle(RECRUIT_NEW, diff)` → `NotificationEventHandler`(async) promise를 await.
  - Hop2 `NOTIFICATION_SEND`: `notifyNewRecruits`가 구독자별 `emitEvent`(fire-and-forget) → **`emitEventAndSettle`로 전환**하고 await → `NotificationSendHandler`(async) → `sendNotificationDM`(REST) promise가 상위로 전파.
- **핸들러 등록·로직 무변경**: `NotificationEventHandler`/`NotificationSendHandler`는 이미 async 함수라 promise를 반환한다. `emitEventAndSettle`가 그 반환 promise를 수집하기만 하면 되므로 핸들러 코드는 손대지 않는다.
- **`emitEvent` 불변**: 기존 fire-and-forget 소비자(인터랙션 유발 이벤트 등)는 그대로 둔다. `emitEventAndSettle`는 **틱 완결이 필요한 경로에서만** 사용한다.
- **순차 발송 블로킹**: `notifyNewRecruits`가 구독자별 DM을 순차 await하면 tick 시간이 구독자 수에 선형 비례한다. 이 블로킹 비용은 **인지만** 하고 실측·최적화는 1.10 E2E로 이월(plan 비기능 요구).

**에러 처리**: `Promise.allSettled`로 한 구독자 실패가 다른 구독자를 막지 않게 한다(`dmSender`는 이미 `DmSendResult`로 흡수 반환 → reject 없음). 핸들러 내부 try-catch(재throw 금지) 패턴 유지.

### 2.4 스케줄러 크롤 경로 재설계 — `crawlAndDiff(mode)`

**파일**: `functions/src/services/recruitService.ts`(메서드 신설), `services/recruitCacheService.ts`(반환값 확장 + emit 추출), 공용 emit 헬퍼

**신설 위치 결정 — `RecruitService`의 메서드 (신규 모듈 아님)**:

| 후보 | 판단 |
|------|------|
| **RecruitService 메서드** ✅ | `crawlAndDiff`가 필요로 하는 협력자(`CrawlService`·`RecruitCacheService`·`RecruitStore`)가 `RecruitService` 생성자에 **이미 배선**되어 있다(`recruitService.ts:27-32`). recruit 도메인 응집을 유지하고, `getRecruitList`와 같은 `setRecruitList` diff 엔진을 공유한다. |
| 신규 모듈 | `CrawlService`/`RecruitCacheService`/`RecruitStore`와 `RedisManager` store 접근을 **재배선(중복)**해야 한다. 두 경로가 정당하게 같은 도메인 협력자·diff 엔진을 공유하므로 응집도상 불리. |

→ **`RecruitService.crawlAndDiff(mode)` 메서드로 신설**한다. `getRecruitList` **무회귀**는 구조적으로 보장된다: (a) `getRecruitList` 본문 미수정, (b) `crawlAndDiff`는 `getRecruitList`의 캐시-read Step을 **읽지도 변형하지도** 않고 강제 크롤 → 공유 diff 엔진(멱등)으로 write.

**핵심 로직**:
```typescript
// RecruitService — 스케줄러 전용. 3-tier(Step1 Redis/Step2 Firestore) 우회.
async crawlAndDiff(mode: CRAWL_MODE): Promise<JobDiffResult> {
  const list = await this.crawler.sriagent(mode);      // 강제 크롤 (캐시 read 없음)
  const { status, diff } = await this.cacheService.setRecruitList(list); // §아래 factoring
  if (status === CacheUpdateStatus.CHANGED) {
    await emitRecruitNewEvent(diff, "RecruitService.crawlAndDiff", { awaitSettle: true }); // §2.3
  }
  return diff;
}
```

- **3-tier 우회**: `getRecruitList`의 Step1(Redis)·Step2(Firestore) read를 건너뛰고 `crawler.sriagent(mode)`로 **강제 크롤**한다. 이로써 "TTL 없는 Firestore canonical doc이 항상 히트해 Step4 크롤에 도달 못 함"(plan 배경)을 해소한다.
- **크롤 스코프 고정**: `crawlAndDiff`는 **city 미지정(전체 지역)** 결과로만 `setRecruitList`를 호출한다(Backend Expert 방어책 d). 부분 스코프 크롤 결과를 diff 엔진에 넣지 않는다 — 그렇지 않으면 다른 지역 공고가 `deletedIds`로 오판된다.
- `crawlService.ts:28` DUMMY 버그(#6)로 DUMMY 모드 강제 크롤이 완전치 않을 수 있으나 **Phase 1.10 이월**(범위 밖).

**diff 엔진 재사용 정합성 (Backend Expert 위임 결과 — 인라인 편입)**:

Redis hash diff 엔진(`setRecruitList`의 `createHashes`→`hashStore.getAll()`→`diffJobs`)을 crawlAndDiff가 재사용하되, awaitable 발행을 위해 아래 factoring을 적용한다:

1. **`setRecruitList` 반환값 확장 + emit 추출**: diff 계산(`diffJobs`)과 영속화(`saveAll`/`syncChanges`)는 **한 메서드 안에 원자적 순서로 유지**한다(read→write 사이 TOCTOU 창을 넓히지 않기 위해 분리하지 않는다). 대신 **내부 `eventBus.emitEvent(RECRUIT_NEW)`만 제거**하고 시그니처를 `Promise<{ status: CacheUpdateStatus; diff: JobDiffResult }>`로 확장한다. `CacheUpdateStatus` enum은 메서드 로컬 선언 → 클래스/`common/types` 레벨로 승격한다.
2. **공용 emit 헬퍼로 CHANGED gating 공유**: emit 책임을 `emitRecruitNewEvent(diff, source, opts)` 헬퍼로 추출해 **두 발행부**(사용자 경로 `RecruitService`의 백업 write, 신규 `crawlAndDiff`)가 동일한 `status === CHANGED` gating + try-catch 방어(발행 실패가 캐시 성공을 막지 않음)를 공유한다 — emit 시맨틱 drift 방지.
3. **사용자 3-tier 무회귀 보장**: `getRecruitList`의 두 백업 호출(Step2 Firestore, `collectAndSaveRecruits`)은 `setRecruitList(...).catch()`로 **반환값을 무시**하므로 `void → Promise<{status,diff}>` 확장에도 fire-and-forget 동작이 문법·동작 100% 유지된다. **단** 내부 emit 제거로 "사용자 크롤 시 CHANGED면 알림 발행"이 사라지므로, 이 두 호출부에 `.then(({status,diff}) => status===CHANGED && emitRecruitNewEvent(diff, "RecruitService", { awaitSettle:false }))`를 **추가**해 기존 알림 계약을 재현한다(= 무회귀는 "emit 위치 이관 + 조건·방어 동일 재현"이 핵심).
4. **hash 상태 공유 경합 방어**: 두 경로(사용자 백업 write·스케줄러 강제 크롤 write)가 같은 Redis `hashStore`/`cacheStore`를 공유 → 동시 진입 시 같은 `currentHashes`를 읽어 **중복 emit**(같은 addedJobs 2회 알림)·부분 갱신 경합 가능. 방어책: `crawlAndDiff` 시작 시 **Redis 분산 락(`SET NX PX`)**으로 diff 계산~저장 구간의 원자성을 확보한다(락은 두 경로가 같은 키 공간을 쓰는 이상 유일한 실용적 수단). 락 도입은 **본 Phase 검토·설계 포함, 정합성 필수**. (이벤트 소비자 레벨 dedup은 알림 계층 사안 → 범위 밖.)
5. **NO_DATA 판정의 스케줄러 타당성**: `hashStore.getAll()`이 null(최초/TTL 만료)이면 NO_DATA → 전량 저장만 하고 **RECRUIT_NEW 미발행**. 이는 "기준선 부재 시 전체를 새 공고로 발행하면 수백 건 DM 스팸"을 막는 **의도된 동작**이다. 단 스케줄러가 변경 감지의 신뢰 경로가 되므로, NO_DATA를 "정상 diff 스킵"과 구분하도록 **로그 레벨 격상(info→warn)**을 권장한다. UNCHANGED(`extendExpiration`)·CHANGED는 호출 주체와 무관하게 diff가 순수 비교라 그대로 타당.

**에러 처리**: `emitRecruitNewEvent` 헬퍼는 발행 실패를 try-catch로 흡수(캐시 갱신은 이미 성공). 크롤 실패는 `crawlAndDiff`가 throw → `runOnce()`가 `RECRUIT_CRAWL_FAILED` 발행(§2.2).

### 2.5 dmSender REST 전환

**파일**: `functions/src/providers/discord/client.ts`(REST 클라이언트 추가), `functions/src/providers/discord/utils/dmSender.ts`(gateway 의존 제거·2-step REST 전환)

**문제**: 현재 `sendNotificationDM`은 **gateway 의존 2점**을 갖는다 — (a) 발송 직전 `await getDiscordReady()`(gateway ClientReady 빗장, `dmSender.ts:117`), (b) `client.users.fetch(userId)` + `user.send()`(gateway 캐시/WS 경로, `dmSender.ts:122-123`). C안 함수 프로세스는 `client.login()`을 호출하지 않고 gateway WS를 열지 않으므로(§1.0, §2.1), ready 빗장은 **영영 열리지 않고**(함수 프로세스엔 `markDiscordReady`를 호출할 ClientReady 이벤트가 없음) `client.users.fetch`도 로그인 토큰이 없어 실패한다. → DM 발송 경로를 **REST 전용**으로 전환해 gateway 로그인·ready와 완전 분리한다.

#### (1) client.ts — REST 클라이언트 분리 (Discord Agent 소유)

gateway `Client`(인터랙션 수신 전용)와 별개로, **독립 `REST` 인스턴스**를 노출한다. `register-commands.ts`가 이미 쓰는 `new REST({ version: "10" }).setToken(...)` 패턴을 재사용해 일관성을 지킨다. 함수 프로세스가 gateway 로그인 없이 REST만 사용할 수 있도록 토큰 주입을 `client.login()`과 분리한다.

**타입/시그니처 정의**:
```typescript
// client.ts — 기존 gateway Client 유지 + REST 추가
import { Client, GatewayIntentBits, REST } from "discord.js";

export const client = new Client({ intents: [ /* 기존 유지 */ ] }); // gateway = 인터랙션 수신

/** DM 발송 전용 REST 클라이언트 — gateway WS/login과 독립. 함수 프로세스가 사용. */
export const rest = new REST({ version: "10" });

/** REST 토큰 주입. 부트스트랩(§2.1)이 프로세스별로 호출. gateway 로그인과 무관. */
export function initDiscordRest(): void {
  rest.setToken(process.env.DISCORD_BOT_TOKEN!);
}
```

- `rest`는 `client.login()`을 필요로 하지 않는다 — `setToken`만으로 REST 호출이 성립한다(gateway WS·ready 빗장 무관).
- **호출 주체는 §2.1 소유**: `initDiscordRest()`를 **누가·언제** 부르는지(= `initFunctionProviders`가 gateway login 없이 REST init만 수행)는 부트스트랩 배선으로 §2.1이 확정한다. 본 절은 함수 시그니처와 "REST가 login과 독립"이라는 계약만 정의한다.
- gateway 프로세스는 이 `rest`를 쓰지 않는다(DM 발송은 함수 프로세스 전담). gateway는 인터랙션용으로 `client`의 ready 빗장만 유지(§2.1).

#### (2) dmSender — 2-step REST 흐름으로 전환

REST로 DM을 보내려면 gateway 캐시가 없으므로 **DM 채널을 먼저 열어야** 한다. discord.js `Routes` 헬퍼로 2단계를 명시한다:

**핵심 로직**:
```typescript
// dmSender.ts — getDiscordReady / client.users.fetch 제거
import { rest } from "@/providers/discord/client";
import { Routes } from "discord.js";

// (기존) await getDiscordReady();  ← 삭제. REST는 ready 빗장 불필요.
// while 재시도 루프 내부:
try {
  // 1) DM 채널 개설 — POST /users/@me/channels { recipient_id }
  const dmChannel = (await rest.post(Routes.userChannels(), {
    body: { recipient_id: userId },
  })) as { id: string };

  // 2) 메시지 전송 — POST /channels/{id}/messages
  await rest.post(Routes.channelMessages(dmChannel.id), {
    body: { embeds: toApiEmbeds(payload.embeds), content: payload.content },
  });

  return { ok: true, durationMs: Date.now() - startedAt, attempts };
} catch (error) { /* (3) 아래 에러 매핑 — 기존 분기 그대로 */ }
```

- **embeds 정규화(내부 변환)**: gateway `user.send()`는 `EmbedBuilder` 객체를 자동 직렬화했으나, raw REST body는 **`APIEmbed` JSON**만 받는다. `DmPayload.embeds`(= `MessageCreateOptions["embeds"]`, 빌더 가능)를 `toApiEmbeds()`로 `.toJSON()` 정규화한다(빌더면 `toJSON()`, 이미 API 객체면 통과). **계약 밖 내부 변환** — `DmPayload` 필드·의미는 불변이고 호출 측 빌더 산출물 전달 방식도 그대로다.
- `Routes.userChannels()` = `POST /users/@me/channels`, `Routes.channelMessages(id)` = `POST /channels/{id}/messages` (discord-api-types 헬퍼, `register-commands.ts`의 `Routes` 사용과 동일 계열).

#### (3) 계약 불변 (§1.2 준수 · 소비자 영향 0)

- **시그니처 동결**: `sendNotificationDM(userId: string, payload: DmPayload): Promise<DmSendResult>` — 매개변수·반환 타입 불변.
- **`DmPayload` / `DmSendResult` 구조·필드 불변**: `embeds`/`content` 입력, `ok`/`skipped`/`reason`/`errorCode`/`durationMs`/`attempts` 출력 전부 그대로. REST 전환은 **함수 본문 내부 변경으로만** 수행한다(§1.2 계약).
- **소비자 영향 0 명시**: `NotificationSendHandler`(§2.3 Hop2 소비자) 및 Phase 1.9/1.10/2.1/2.2 공유 계약은 시그니처·결과 구조가 동일하므로 **무변경**. §2.3의 `emitEventAndSettle` await 체인은 `sendNotificationDM`이 반환하는 promise만 수집하면 되고 반환 형태가 불변이라 그대로 연결된다.
- `MAX_ATTEMPTS=3`(최초 1 + 재시도 2), `BASE_BACKOFF_MS`, `FALLBACK_RATE_LIMIT_MS` 상수와 순차 재시도 루프 구조도 유지.

#### (4) 에러 처리 보존 — gateway 예외 → REST 응답 매핑

REST 전환으로 예외 **형태**가 gateway 예외 → REST `DiscordAPIError`/`HTTPError`로 바뀌지만, 기존 에러코드 추출·분기 의미를 **동일 코드값**으로 보존한다. providers 계층 규칙대로 **throw 금지·`DmSendResult`로 흡수 반환**을 유지한다.

| 기존 분기 (gateway) | REST 대응 | 추출 경로 | 처리 (불변) |
|--------------------|-----------|-----------|-------------|
| `50007` DM 차단/공유 길드 없음 | `DiscordAPIError.code === 50007` (채널 개설 step1 또는 전송 step2에서 발생) | `getErrorCode(err)` = `.code`(number) | graceful skip `{ ok:false, skipped:true, reason:"dm_disabled" }`, 재시도 없음 |
| `10013` Unknown User | `DiscordAPIError.code === 10013` (step1 recipient_id 무효) | `getErrorCode(err)` = `.code` | 실패 `{ ok:false, reason:"unknown_user" }`, 재시도 없음 |
| `429` / RateLimitError | REST 내부 큐 흡수(`rejectOnRateLimit: null` 기본)로 보통 미노출. 방어적으로 `RateLimitError`(`retryAfter`/`timeToReset` ms) 또는 `DiscordAPIError.status === 429` | `getRateLimitWaitMs(err)` (ms, `*1000` 금지) | 대기 후 재시도 |
| 그 외 미지 코드 | `HTTPError`/`DiscordAPIError`(5xx 등) | `getErrorCode` = undefined | 짧은 backoff 후 재시도, 소진 시 `{ ok:false, reason:"max_retries" }` |

- **에러코드 매핑 정합성(핵심)**: `DiscordAPIError.code`는 **gateway·REST 무관하게 동일한 Discord 에러 코드**(50007/10013)를 노출한다. 따라서 기존 `getErrorCode()`(`.code`가 number일 때만 반환)·`getRateLimitWaitMs()`는 **수정 없이 REST 예외에서도 같은 코드를 추출**한다. 단 REST는 `.status`(HTTP)도 함께 가지므로, 429 방어 분기의 `e.status === 429` 경로가 REST에서 더 정확히 작동한다(기존 로직 유지로 충분).
- **2-step의 에러 귀속**: step1(채널 개설)·step2(전송) 예외를 **동일 `try`로 감싸** 기존 단일 catch 분기 체계를 그대로 재사용한다 — 어느 step에서 던져도 `code`/`status` 기반 분류가 동일하게 적용된다.
- **재시도 3회 + 429 `retry_after` 보존**: REST 내부 큐가 대부분의 rate limit을 흡수하지만, 방어적 `getRateLimitWaitMs` 대기값(ms)·최대 3회 루프는 유지한다(중복 대기 우려 없음 — REST 큐 대기와 애플리케이션 재시도는 계층이 다르며 기존 계약).

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

본 Phase는 **신규 컬렉션·스키마 변경 없음**. `getRecruitList`/`crawlAndDiff`는 기존 recruit canonical doc과 Redis hash/cache store를 그대로 사용한다. 크로스-프로세스 Firestore 트리거(DB-as-bus)는 **방침만 명시**하며 컬렉션 설계는 Phase 2.1/2.2 이월.

### 3.2 이벤트 페이로드

본 Phase는 **신규 이벤트 타입 없음** — 기존 이벤트가 함수 프로세스(EventBus #2)에서 awaitable로 흐른다. 페이로드 계약 전부 **불변**.

| 이벤트 타입 | 페이로드 | 발행 시점 | 변경 |
|------------|---------|----------|------|
| `RECRUIT_CRAWL_STARTED` | `RecruitCrawlStartedEvent` | `runOnce()` tick 시작 | 불변 |
| `RECRUIT_CRAWL_COMPLETED` | `RecruitCrawlCompletedEvent` | `runOnce()` performWork 성공 | 불변 |
| `RECRUIT_CRAWL_FAILED` | `RecruitCrawlFailedEvent` | `runOnce()` performWork 실패 | 불변 |
| `RECRUIT_NEW` | `RecruitNewEvent` (`JobDiffResult`) | `crawlAndDiff` diff=CHANGED 시 (emit 위치만 `setRecruitList` 내부 → 공용 헬퍼로 이관) | 페이로드 불변 |
| `NOTIFICATION_SEND` | `NotificationSendEvent` | `notifyNewRecruits` 구독자별 (emit → `emitEventAndSettle`로 전환, 페이로드 동일) | 페이로드 불변 |
| `NOTIFICATION_SENT` | `NotificationSentEvent` | `NotificationSendHandler` DM 발송 후 | 불변 |

> **메서드 추가(계약 아님)**: `EventBus.emitEventAndSettle`는 additive 메서드로, `EventPayloadMap`·기존 `emitEvent` 계약을 변경하지 않는다.

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 |
|------|------|------|----------|
| 1 | `EventBus.emitEventAndSettle` 추가 (additive) | `events/bus/EventBus.ts` | §2.3 |
| 2 | `setRecruitList` 반환값 확장 + 내부 emit 제거, `CacheUpdateStatus` enum 승격 | `services/recruitCacheService.ts` | §2.4 |
| 3 | 공용 `emitRecruitNewEvent(diff, source, opts)` 헬퍼 신설 (CHANGED gating + try-catch) | `common/...` | §2.4 |
| 4 | `RecruitService`: `getRecruitList` 두 백업 호출부에 emit 헬퍼 배선(무회귀), `crawlAndDiff(mode)` 신설 + Redis 분산 락 | `services/recruitService.ts` | §2.4 |
| 5 | `notifyNewRecruits` → `emitEventAndSettle`로 전환 (await 전파) | `services/notificationService.ts` | §2.3 |
| 6 | `BaseScheduler` `runOnce()` 추출(setTimeout 루프 격리), `startWork` 재구성 | `crawlers/schedulers/base/BaseScheduler.ts` | §2.2 |
| 7 | `RecruitScheduler.performWork` → `crawlAndDiff`, `SchedulerManager.runRecruitOnce` | `crawlers/schedulers/RecruitScheduler.ts`, `SchedulerManager.ts` | §2.2 |
| 8 | provider 번들 분리 `initGatewayProviders`/`initFunctionProviders` | `providers/index.ts` | §2.1 |
| 9 | gateway 부트스트랩: 스케줄러 시작 제거 | `app/index.ts` | §2.1 |
| 10 | 함수 부트스트랩 신규 + `onSchedule` 트리거 + 로컬 env 게이팅 | `app/scheduler.ts` (신규) | §2.1 |
| 11 | dmSender REST 전환 (**Discord Agent**) | `providers/discord/**` | §2.5 |

> 순서 근거: EventBus(1) → 서비스 계층 diff/emit(2~5) → 스케줄러 단일 tick(6~7) → 진입점 배선(8~10) → dmSender REST(11, Discord Agent). §2.5는 §2.3 파이프라인이 정한 `DmPayload`/`DmSendResult` 계약 불변 하에 병행 가능.

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] `SystemLogger`(`globalLogger`/`providerLogger`) 사용, `console.log` 금지
- [ ] `SystemError` 패턴 준수, provider 계층 throw 금지(결과 흡수 반환)
- [ ] EventBus 타입 안전 이벤트(`emitEvent`/`emitEventAndSettle` 제네릭)
- [ ] 핸들러 내부 try-catch, emitter로 재throw 금지
- [ ] JSDoc(public API: `runOnce`/`crawlAndDiff`/`emitEventAndSettle`/`initFunctionProviders`)
- [ ] 한국어 주석(필요 시)
- [ ] `DmPayload`/`DmSendResult` 계약 불변, `getRecruitList` 3-tier 무회귀, 인터랙션 수신 코드 무변경

---

## 6. 테스트 계획

> **⚠️ 스코프 경계 (필수 명시)**: 본 테스트 계획은 **정적(TypeScript 컴파일) / 로컬 DUMMY 한정**이다. 아래는 **모두 Phase 1.10 이월**이며 1.13의 미검증을 갭으로 오탐하지 않는다: **onSchedule 실발화(Cloud Scheduler)·실 CRAWL(`recruitMode: CRAWL`)·REST 실전송·실배포(gateway Cloud Run + 함수)·프로덕션 E2E·`crawlService.ts:28` DUMMY 버그(#6)**. Firestore 트리거(크로스-프로세스 DB-as-bus) **실제 배선도 2.1/2.2 이월**(1.13은 방침만).

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 전체 컴파일 | `npx tsc --noEmit` | 에러 없음 |
| 진입점 분리 | 정적 리뷰 | gateway 부트스트랩에 `initializeSchedulers` 없음, 함수 부트스트랩에 gateway WS/ready 대기 없음 |
| `emitEventAndSettle` additive | 정적 리뷰 | 기존 `emitEvent` 시그니처·`EventPayloadMap` 불변 |
| `runOnce()` 루프 격리 | 정적 리뷰 | `runOnce()` 내부에 `scheduleNextExecution()` 호출 없음(단일 tick) |
| 틱 완결 await 전파 | 정적 리뷰 | `crawlAndDiff` → `emitEventAndSettle(RECRUIT_NEW)` → `notifyNewRecruits`가 `NOTIFICATION_SEND`를 await → dmSender까지 promise 체인 연결 |
| `crawlAndDiff` 3-tier 우회 | 정적 리뷰 | Step1 Redis/Step2 Firestore read 미호출, 강제 크롤 진입, city 미지정 전체 스코프 |
| `getRecruitList` 무회귀 | 정적 리뷰 | 본문 미수정, 두 백업 호출부에 emit 헬퍼 배선(CHANGED 알림 계약 재현) |
| diff 정합성 (락) | 정적 리뷰 | `crawlAndDiff`에 Redis 분산 락, `setRecruitList` diff/persist 원자 순서 유지 |
| `DmPayload`/`DmSendResult` 계약 | 정적 리뷰(Contract) | 시그니처·필드 불변 |
| 인터랙션 수신 무변경 | 정적 리뷰 | `onInteraction.ts`/`discordListeners.ts` diff 없음 |
| 로컬 DUMMY E2E | `RUN_SCHEDULER_ONCE=true` 로컬 실행 | `crawlAndDiff` diff 발행 + REST DM 수신(로컬 DUMMY 범위) |

---

*작성일: 2026-08-04*
*참고: docs/phase-1-13/01-plan.md*

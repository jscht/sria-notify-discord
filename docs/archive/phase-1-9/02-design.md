# Phase 1.9 설계서: 알림 파이프라인 startup wiring + 로컬 E2E

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-9/01-plan.md`

> **설계 원칙**: 신규 비즈니스 로직 없음. 이미 구현된 조각(`registerAllEventHandlers`, `initializeSchedulers`, `setupGracefulShutdown`, `onReady`, `BaseScheduler.startWork` 멱등 가드)을 **부팅 순서로 연결만** 한다. 신규 코드는 ready 게이트 노출(leaf `discordReady.ts`), `enableProxy` 게이팅, dmSender 발송 직전 `await getDiscordReady()` 1줄 3건뿐.
>
> **R3 import 순환 해소 (do 착수 시 확정 — A안 + 루트 분리)**: ready 채널은 `initDiscordBot.ts`가 아니라 **의존 0의 leaf 모듈 `providers/discord/discordReady.ts`**에 둔다(A안). `dmSender`는 이 leaf에서 `getDiscordReady`를 직접 import → `dmSender→initDiscordBot` 화살표 제거. 추가로 `events` 배열을 `events/discordListeners.ts`로 분리하고 `initDiscordBot`이 대문(`events/index.ts`) 대신 그 좁은 모듈에서 import(루트 분리) → `initDiscordBot→registerAllEventHandlers→…→dmSender` 근원 제거. 둘 다 적용 시 순환이 **물리적으로 불가능**(대문은 `events` 재노출로 외부 API 유지). 본 문서 §2.1/§2.7의 코드는 이 확정안으로 동기화됨.

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

> 템플릿 경로를 실제 구조(`app/`, `providers/`, `crawlers/`, `common/`, `events/`)에 맞게 조정.

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| App 진입점 (`functions/src/app/`) | `index.ts` eager 블록에 `.then(register → scheduler → shutdown)` 체인 추가. provider init 체인은 그대로 두고, 성공 시에만 핸들러 등록·스케줄러 시작 |
| Providers (`functions/src/providers/`) | `index.ts` 무변경(★ HTTP 비결합 핵심 — 아래 §2.1). **`discord/discordReady.ts` 신규(leaf, 의존 0)** — ready promise + `getDiscordReady()`/`markDiscordReady()`(R3 A안). `discord/initDiscordBot.ts` async 전환 + `markDiscordReady()` 호출 + `events`를 좁은 모듈에서 import(루트 분리). `discord/register-commands.ts` env rename |
| Crawlers (`functions/src/crawlers/`) | `schedulers/utils/initializeSchedulers.ts`: `SchedulerInitConfig`에 `enableProxy?: boolean`(기본 `true`) 추가 → false면 `startProxyScheduler` 게이팅. `SchedulerManager`/`BaseScheduler` **무변경**(멱등 가드 기존재 — §2.4) |
| Common (`functions/src/common/`) | `middlewares/initializeWorker.ts`: 주석 처리된 스케줄러 init 블록(12~15줄) 정리. 로직 변경 없음 |
| Events (`functions/src/events/`) | **`discordListeners.ts` 신규(R3 루트 분리)** — `events` 배열(onReady/onPingPongCreate/onInteraction) 이관, `registerAllEventHandlers` 미포함. `index.ts`는 `events`를 재노출로 대체(외부 API 불변). `registerAllEventHandlers`·`onReady` 기존 재사용 |
| Env (`functions/.env`) | `SARIAN_*` 4키 → `DISCORD_*` rename |

### 1.2 컴포넌트 다이어그램

```
app/index.ts (모듈 로드 시 eager 실행)
  │
  ├─ registerGlobalErrorHandlers()
  │
  ├─ initializeProviders()  ──────────────────────────────────┐
  │     │  Promise.all([initFirebaseApp, initRedis,           │ (★ 이 체인은 reject 안 됨:
  │     │                initDiscordBot])                      │  initDiscordBot는 항상 resolve)
  │     │       └─ initDiscordBot: client.login() 시도         │
  │     │            + onReady once 핸들러가 readyResolve() 호출 ┘
  │     │
  │     .then(() => {                    // provider init 성공 후 1회
  │        registerAllEventHandlers();   // EventBus 리스너 등록 (handlersRegistered 가드)
  │        const mgr = initializeSchedulers({ recruitMode: DUMMY, enableProxy: false });
  │        setupGracefulShutdown(mgr);   // SIGINT/SIGTERM
  │     })
  │     .catch((e) => globalLogger.error(...))   // 실패는 로그만 (HTTP 비결합)
  │
  ├─ initExpress()  →  firebaseDeploy()  →  export default appServer
  │
  └─ [별도 채널] getDiscordReady(): Promise<void>   ← 스케줄러/E2E 게이트로만 사용 (선택)

[부팅 직후] RecruitScheduler.startWork() → scheduleNextWork() (지연 0)
  → performWork() → getRecruitList(DUMMY) → (캐시 miss 시) setRecruitList
  → eventBus.emit(RECRUIT_NEW)
       │
       ▼
  registerAllEventHandlers가 등록한 핸들러 체인:
  NotificationEventHandler  →  NOTIFICATION_SEND  →  NotificationSendHandler
       →  sendNotificationDM()  →  실제 DM  →  NOTIFICATION_SENT 로그
```

---

## 2. 상세 설계

### 2.1 ★ Discord ready 게이트 (HTTP 비결합) — 최우선

**파일**: `functions/src/providers/discord/discordReady.ts`(신규 leaf — ready 채널), `functions/src/providers/discord/initDiscordBot.ts`(async 전환 + `markDiscordReady` 호출)

**문제 재확인**:
`initializeProviders()`는 `Promise.all([initFirebaseApp, initRedis, initDiscordBot])`를 `initPromise`로 memoize하고, `initializeWorker` 미들웨어가 **매 HTTP 요청마다 `await initializeProviders()`** 한다. 따라서 `initDiscordBot`을 단순 async화해 ready 실패(토큰 오류·gateway 끊김)를 throw하면 → `Promise.all` reject → `initPromise` reject → **모든 HTTP 요청이 500**. 게다가 `providers/index.ts`의 catch는 `initPromise = null`로 리셋하므로 매 요청 재시도 폭주.

**해결 (CTO 확정 방향 — resolve 흡수 + 별도 ready 채널, R3로 leaf 분리)**:
`initDiscordBot`은 (1) `client.login()`을 **시도하되**, (2) ready/실패를 **throw하지 않고 항상 resolve**하여 provider init 체인을 reject시키지 않는다. ready 상태는 `Promise.all` **바깥의 의존 0 leaf 모듈** `providers/discord/discordReady.ts`로 분리해 `getDiscordReady(): Promise<void>` + `markDiscordReady()`로 노출하고, **dmSender 발송 게이트·E2E 게이트로만** 사용한다. leaf 분리가 R3 import 순환 차단의 핵심(`dmSender`는 `initDiscordBot`이 아니라 이 leaf를 import).

> **`initializeProviders()` / `providers/index.ts`는 무변경.** `initDiscordBot()`의 반환 계약(항상 resolve)만 바꾸면 `Promise.all`은 그대로 안전하다. 이것이 HTTP 비결합의 핵심 — provider 체인을 건드리지 않는다.

**인터페이스/타입 정의**:
```typescript
// providers/discord/discordReady.ts — 신규 leaf 모듈 (의존 0)

/** ready까지 대기. 이미 열렸으면 즉시 통과. login 실패 시에도 resolve(무한대기 방지). */
export function getDiscordReady(): Promise<void>;

/** 빗장을 연다(일방향). ClientReady 또는 login 실패 catch에서 1회 호출. */
export function markDiscordReady(): void;

// providers/discord/initDiscordBot.ts
/**
 * Discord 봇 초기화. 이벤트 핸들러 바인딩 + login 시도.
 * 항상 resolve한다 (login 실패를 throw하지 않음 → Promise.all 안전).
 */
export function initDiscordBot(): Promise<void>;
```

**핵심 로직** (pseudo):
```typescript
// providers/discord/discordReady.ts — leaf (events/dmSender/client 미import → 순환 차단점)
let resolveReady: () => void;
export const discordReady: Promise<void> = new Promise((r) => { resolveReady = r; });
export function getDiscordReady(): Promise<void> { return discordReady; }
export function markDiscordReady(): void { resolveReady(); }

// providers/discord/initDiscordBot.ts
import { Events } from "discord.js";
import { providerLogger } from "@/common/utils/systemLogger";
import { client } from "./client";
import { markDiscordReady } from "./discordReady";
import { events } from "@/events/discordListeners";   // ★ 대문 아닌 좁은 모듈 (루트 분리)

export async function initDiscordBot(): Promise<void> {
  // 기존 이벤트 핸들러 바인딩 유지 (onReady once 포함)
  for (const { once, event, execute } of events) {
    once ? client.once(event, execute) : client.on(event, execute);
  }

  // ready 빗장: onReady(로깅)와 별개로 resolve 전용 once 리스너
  client.once(Events.ClientReady, () => { markDiscordReady(); });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);   // ★ rename
  } catch (error) {
    // ★ throw 금지 — provider init 체인 보호 (HTTP 비결합).
    providerLogger.error("Discord login failed (HTTP unaffected)", error as Error);
    markDiscordReady(); // ready 대기자 무한 블로킹 방지 ('대기 종료' 의미)
  }
  // 항상 resolve로 종료 → Promise.all 안전
}
```

> **`await client.login` vs ready 분리 근거**: `client.login()`은 게이트웨이 핸드셰이크 시작까지만 await한다. 실제 `ClientReady`는 그 뒤 이벤트로 도착하므로 `client.once(Events.ClientReady)`로 받아 `discordReady`를 resolve한다. login 단계 실패(잘못된 토큰 등)는 try/catch가 흡수하고, ready 대기자가 영원히 멈추지 않도록 catch에서도 `resolveReady()`를 호출한다.

> **app/index.ts 연동**: 본 Phase의 `.then` 체인은 `initializeProviders()`(=`initDiscordBot` 포함) 성공만 await하면 스케줄러를 시작하기에 충분하다. `getDiscordReady()`는 **E2E 검증·향후 게이팅용 선택 채널**로 export만 해 두고, `.then` 체인에서 굳이 `await getDiscordReady()`로 막지 않는다(막으면 ready 지연이 스케줄러 시작을 늦춤 — 첫 크롤 지연 발생). 스케줄러는 즉시 시작(게이트 X) — 안전성은 dmSender가 발송 직전 `await getDiscordReady()`로 ready를 보장하기 때문(§2.7). graceful skip이 race를 흡수하는 게 아니다(ClientReady 전 fetch는 max_retries 실패로 DM 유실).

**에러 처리**:
- login 실패: `providerLogger.error`로 기록, throw 안 함. SystemError 승격 불필요(현행 fire-and-forget 동작 대비 회귀 없음, HTTP 보호 우선).
- `console.log` 금지 → `providerLogger`(LogSource `provider`) 사용.

### 2.2 app/index.ts 부팅 순서 연결

**파일**: `functions/src/app/index.ts`

**핵심 로직** (현재 `initializeProviders().catch(...)`를 `.then().catch()`로 교체):
```typescript
import { CRAWL_MODE } from "@/common/constants";
import { initializeSchedulers, setupGracefulShutdown } from "@/crawlers";
import { registerAllEventHandlers } from "@/events";
import { initializeProviders } from "@/providers";

// 모듈 로드 시점 eager init. initializeProviders()는 메모이즈되어
// 미들웨어가 다시 호출해도 같은 promise를 await할 뿐 중복 실행되지 않는다.
initializeProviders()
  .then(() => {
    // provider init 성공 후 1회 — 모두 멱등 (handlersRegistered / Singleton / isRunning 가드)
    registerAllEventHandlers();                       // EventBus 리스너 등록
    const mgr = initializeSchedulers({
      recruitMode: CRAWL_MODE.DUMMY,
      enableProxy: false,                             // Proxy는 Phase 1.10 — 본 Phase 비활성
    });
    setupGracefulShutdown(mgr);                       // SIGINT/SIGTERM
  })
  .catch((error) => {
    // 실패는 로그만 — HTTP 가용성과 비결합 (현행 동작 보존)
    globalLogger.error("Eager startup wiring failed:", error);
  });
```

> Express 부팅(`initExpress` → `firebaseDeploy` → `export default`)은 **이 체인과 독립적으로 그대로 진행**된다. eager 체인 실패가 서버 export를 막지 않는다.

**에러 처리**: 기존 `globalLogger.error` 유지. SystemError 패턴은 하위(`initRedis` 등)에서 이미 처리.

### 2.3 스케줄러 `enableProxy` 게이팅

**파일**: `functions/src/crawlers/schedulers/utils/initializeSchedulers.ts`

**인터페이스/타입 정의** (필드 1개 추가, 하위호환):
```typescript
export interface SchedulerInitConfig {
  recruitInterval?: number;
  recruitMode?: CRAWL_MODE;
  proxyInterval?: number;
  enableProxy?: boolean; // 기본 true (하위호환). false면 ProxyScheduler 미시작
}
```

**핵심 로직**:
```typescript
export function initializeSchedulers(config?: SchedulerInitConfig): SchedulerManager {
  const manager = SchedulerManager.getInstance();

  manager.startRecruitScheduler(
    config?.recruitInterval ?? 4 * 60 * 60 * 1000,
    config?.recruitMode ?? CRAWL_MODE.DUMMY
  );

  // enableProxy 미지정 시 기존 동작(시작) 유지 — 하위호환
  if (config?.enableProxy !== false) {
    manager.startProxyScheduler(config?.proxyInterval ?? 6 * 60 * 60 * 1000);
  } else {
    globalLogger.info("⏭️ ProxyScheduler skipped (enableProxy=false)");
  }

  globalLogger.info("✅ Schedulers initialized");
  return manager;
}
```

> 1.9는 `enableProxy: false`로 RecruitScheduler만 시작. Proxy 활성화·저장은 Phase 1.10.

### 2.4 ★ startWork() 이중 호출 멱등 가드 — 위치 확정 (신규 코드 없음)

**파일**: `functions/src/crawlers/schedulers/base/BaseScheduler.ts` (**무변경 — 가드 기존재 확인**)

CTO가 지정한 "`startWork()` 이중 호출 가드(이미 실행 중이면 skip)"는 **이미 `BaseScheduler.startWork()` 최상단에 존재**한다:
```typescript
startWork(): void {
  if (this.isRunning) {
    globalLogger.info(`[${this.config.name}] ⚠️ Scheduler is already running.`);
    return;   // ← 이중 startWork → 타이머 중복 방지 (이미 구현됨)
  }
  this.isRunning = true;
  ...
}
```

**가드 위치 확정**: BaseScheduler (모든 스케줄러 공유). `SchedulerManager.startRecruitScheduler`는 인스턴스를 `Map`으로 재사용하고, 호출마다 `startWork()`를 부르지만 → BaseScheduler `isRunning` 가드가 두 번째 호출을 skip하므로 **타이머 중복 없음**. **신규 가드 추가 불필요** — design 결론은 "기존 가드로 충분, 신규 로직 0건".

> 따라서 cold-start 재진입·중복 init(eager 체인이 어떤 이유로 2회 진입)이 발생해도: `initializeProviders` memoize + `handlersRegistered` 가드 + `BaseScheduler.isRunning` 가드 3중으로 멱등 보장.

### 2.5 env rename (`SARIAN_*` → `DISCORD_*`)

**파일**: `functions/.env`, `providers/discord/initDiscordBot.ts`, `providers/discord/register-commands.ts`

| 기존 (`SARIAN_*`) | 변경 (`DISCORD_*`) | 사용처 |
|------|------|------|
| `SARIAN_BOT_TOKEN` | `DISCORD_BOT_TOKEN` | `initDiscordBot.ts:14`, `register-commands.ts:13` |
| `SARIAN_APP_ID` | `DISCORD_APP_ID` | `register-commands.ts:20` |
| `SARIAN_TEST_GUILD_ID` | `DISCORD_TEST_GUILD_ID` | `register-commands.ts:20` |
| `SARIAN_PUBLIC_KEY` | `DISCORD_PUBLIC_KEY` | (현재 코드 미참조 — .env만 rename) |

> **env 표기 메모(범위 외)**: `functions/CLAUDE.md`는 app id를 `DISCORD_CLIENT_ID`로 기재. 본 rename은 기계적 `DISCORD_APP_ID` 유지(코드 일관성). 문서 정합화는 후순위 — Phase 1.9 범위 외.
> **프로덕션 영향 없음**: 로컬 `.env`만 대상. 프로덕션 배포 이력 없음(외부 secret store 무관).

### 2.6 initializeWorker 주석 정리

**파일**: `functions/src/common/middlewares/initializeWorker.ts`

12~15줄의 "스케줄러는 별도 의사결정 영역으로 분리됨" 주석을, 스케줄러 init이 `app/index.ts` eager 블록에서 시작됨을 명시하도록 정리. 미들웨어는 `await initializeProviders()`만 수행(로직 무변경).

```typescript
// 스케줄러 init은 app/index.ts eager 블록에서 provider init 성공 후 1회 시작한다 (Phase 1.9).
// 미들웨어는 provider init 완료만 await — 스케줄러는 모듈 로드 시 이미 시작됨.
```

### 2.7 ★ dmSender 발송 직전 ready 게이트 (C안 — Validator Critical 해소)

**파일**: `functions/src/providers/discord/utils/dmSender.ts`

**문제 (Validator Critical — ready race)**:
ClientReady 전 `client.users.fetch()` 에러는 dmSender가 graceful skip하는 50007도, 10013도 아닌 **미지 코드**로 분류된다 → 3회 재시도 후 `max_retries` 실패(ok:false, **skipped 아님**) → **DM 유실**. 즉 graceful skip이 ready race를 흡수하지 못한다. 기존 §2.1 주장("graceful skip이 흡수")은 이 지점에서 틀렸다.

**해결 (C안 — 스케줄러 게이트 X, 발송 직전 게이트 O)**:
스케줄러는 그대로 즉시 시작(사용자 설계 철학 유지)하고, `sendNotificationDM` 진입부에서 **`while` 재시도 루프 진입 전 1회** `await getDiscordReady();`를 추가한다. import 경로는 **leaf `@/providers/discord/discordReady`**(R3 — `initDiscordBot` 아님, 순환 차단). `client.users.fetch()`는 현재 117번 줄 재시도 루프 **안**에 있으므로, ready 대기는 루프 **밖(위)** 1회로 둬 재시도마다 재-await하지 않는다.

봇이 실제 필요한 곳은 `client.users.fetch()` 한 곳뿐이라, 크롤·diff·구독자조회가 진행되는 동안 봇이 백그라운드로 연결되어 **실질 지연 0**. login 영구 실패 시에도 `getDiscordReady`는 resolve(대기 종료)되므로 무한 대기 없이 fetch를 시도하고, 실제 차단된 DM이면 그때 50007 graceful skip이 흡수한다.

```typescript
import { getDiscordReady } from "@/providers/discord/discordReady";   // ★ leaf (순환 차단)
// ...
export async function sendNotificationDM(userId, payload) {
  // ClientReady 전 fetch는 max_retries 실패 → DM 유실. 발송 전 ready 보장 (race 해소, 실질 지연 0).
  await getDiscordReady();   // ← while 루프 진입 전 1회
  while (attempts < MAX_ATTEMPTS) {
    const user = await client.users.fetch(userId);  // (기존 루프 그대로 — 현 117번 줄)
    // ...
  }
}
```

> (선택) private `resolveUser()` 헬퍼로 `await getDiscordReady(); return client.users.fetch(userId);`를 캡슐화할 수 있다 — 강제 아님.

**효과**: dmSender는 1.8 공유 계약 파일이므로 모든 발송처(1.9/1.10/2.1/2.2)가 공통으로 혜택을 받는다. login 영구 실패 시에도 `getDiscordReady`가 resolve되어 무한 대기가 없고, 실제 차단이면 50007 graceful skip으로 흡수된다.

**에러 처리**: `getDiscordReady()`는 reject하지 않으므로(§2.1 항상 resolve) 신규 try/catch 불필요. fetch 이후 에러 분류·재시도는 기존 dmSender 로직 그대로.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

신규/변경 없음. 기존 `users/{userId}/notifications/settings`(구독자 조회용, Phase 1.4)만 읽기로 사용.

### 3.2 이벤트 페이로드

신규 이벤트 정의 없음. **기존 이벤트 흐름을 startup에서 연결만** 한다.

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| `RECRUIT_CRAWL_STARTED` | `{ timestamp, source, schedulerName }` | `BaseScheduler.scheduleNextWork` 진입 (기존) |
| `RECRUIT_NEW` | `{ addedJobs, updatedJobs, deletedIds }` | `recruitCacheService`가 **기존 baseline 대비 변경(added/updated/deleted) 감지 시**(`CHANGED` 분기, 기존). ⚠️ 빈 캐시(`NO_DATA`)는 baseline 적재만 하고 **미발행** |
| `NOTIFICATION_SEND` | (핸들러 내부 계약) | `NotificationEventHandler`가 RECRUIT_NEW 수신 후 발행 (기존) |
| `NOTIFICATION_SENT` | (핸들러 내부 계약) | `NotificationSendHandler`가 DM 전송 후 (기존) |
| `RECRUIT_CRAWL_COMPLETED` / `FAILED` | `{ ..., duration }` | `BaseScheduler` 작업 종료 (기존) |

> **본 Phase는 발행원/구독자 코드를 만들지 않는다.** `registerAllEventHandlers()`를 startup에서 1회 호출해 구독자(NotificationEventHandler, NotificationSendHandler)를 EventBus에 **연결**할 뿐.

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | **leaf `discordReady.ts` 신규** — `discordReady` promise + `getDiscordReady()`/`markDiscordReady()`(의존 0) | `providers/discord/discordReady.ts` | §2.1 |
| 2 | **`discordListeners.ts` 신규(events 배열 이관) + `events/index.ts` 재노출 전환**(루트 분리) | `events/discordListeners.ts`, `events/index.ts` | §1.1, R3 |
| 3 | `initDiscordBot` async 전환 + `markDiscordReady()` 호출 + `events`를 `@/events/discordListeners`에서 import + `DISCORD_BOT_TOKEN`(login try/catch, 항상 resolve) | `providers/discord/initDiscordBot.ts` | §2.1 |
| 4 | env rename: `.env` 4키 `SARIAN_*`→`DISCORD_*`(blind 치환) | `functions/.env` | §2.5 |
| 5 | `register-commands.ts` env rename (`DISCORD_BOT_TOKEN`/`DISCORD_APP_ID`/`DISCORD_TEST_GUILD_ID`) | `providers/discord/register-commands.ts` | §2.5 |
| 6 | `SchedulerInitConfig`에 `enableProxy?: boolean` 추가 + Proxy 게이팅 | `crawlers/schedulers/utils/initializeSchedulers.ts` | §2.3 |
| 7 | `app/index.ts` eager 블록 `.then(register → scheduler({enableProxy:false}) → shutdown).catch(log)` | `app/index.ts` | §2.2 |
| 8 | `dmSender` 발송 직전 ready 게이트: `while` 루프 진입 전 `await getDiscordReady();` 1줄 + leaf import | `providers/discord/utils/dmSender.ts` | §2.7 |
| 9 | `initializeWorker.ts` 주석 정리 (스케줄러 init 위치 확정 반영) | `common/middlewares/initializeWorker.ts` | §2.6 |
| 10 | `npx tsc --noEmit` 컴파일 + `SARIAN_*` 잔여 0 grep + 순환 부재 확인 | — | §6 |

> `BaseScheduler`/`SchedulerManager`는 **무변경**(멱등 가드 기존재 — §2.4).
> 순서 근거: leaf(1)·initDiscordBot(3)이 `getDiscordReady`/`markDiscordReady`를 먼저 정의해야 소비처(7 app, 8 dmSender) import 가능. 루트 분리(2)는 initDiscordBot(3)이 좁은 모듈을 import하기 전 선행. `.env`(4)는 코드와 무관히 선행 가능.

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger 사용 (`globalLogger`/`providerLogger`, `console.log` 금지)
- [ ] SystemError 패턴 준수 (본 Phase는 신규 throw 경로 없음 — login 실패는 로그만, HTTP 보호 우선)
- [ ] EventBus 타입 안전 이벤트 (제네릭) — 기존 흐름 재사용, 신규 발행 없음
- [ ] JSDoc 주석 (`getDiscordReady`, `initDiscordBot` public API)
- [ ] 한국어 주석 (ready 게이트 의도·HTTP 비결합 근거 명시, dmSender 발송 직전 게이트는 race 해소 인과 1줄 §2.7)
- [ ] TypeScript strict — `getDiscordReady` 반환 타입 명시, `enableProxy?` optional 하위호환

---

## 6. 테스트 계획

> Phase 3 테스트 프레임워크 도입 전 — 정적 검증 + 로컬 emulator 수동 E2E.

### 6.1 정적 검증

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| TypeScript 컴파일 | `npx tsc --noEmit` | 에러 없음 |
| `SARIAN_*` 코드 잔여 | `Select-String 'SARIAN_' functions/src -r` | 0건 |
| `SARIAN_*` .env 잔여(값 미노출) | `(Get-Content functions/.env | Select-String 'SARIAN_').Count` | `0` (카운트만, 매칭 라인 미출력) |
| `DISCORD_*` 부팅 참조 | grep `process.env.DISCORD_` | `BOT_TOKEN`/`APP_ID`/`TEST_GUILD_ID` 존재 |
| ready 게이트 HTTP 비결합 | `providers/index.ts` 무변경 확인 + `initDiscordBot` catch에서 throw 없음 | provider 체인 reject 불가 |
| import 순환 부재 (R3) | `dmSender`가 `initDiscordBot` 미import + `initDiscordBot`이 대문 아닌 `@/events/discordListeners`에서 import + `discordListeners`에 `registerAllEventHandlers` 미포함 | `tsc` 통과 + grep 확인 |

### 6.2 로컬 emulator DUMMY E2E (★ 사용자 수동 — 봇 실행 필요)

> ⚠️ Claude는 봇을 실행할 수 없음. 아래는 사용자가 직접 수행하는 체크리스트.

**E2E 전제 (필수 — 미수행 시 무발화)**:

⚠️ **트리거 정정 (2026-06-25, 런타임 검증으로 발견)**: `setRecruitList`는 **빈 캐시(`currentHashes` 없음) → `NO_DATA` 분기로 baseline만 저장하고 RECRUIT_NEW를 발행하지 않는다**(`recruitCacheService.ts:50-66`). 발행은 **기존 baseline 대비 diff(`CHANGED`)에서만**. 따라서 "Redis 전체 비움 → 전건 added"는 **성립하지 않는다**(`currentHashes`가 null이면 `diffJobs` 진입조차 안 함). 또한 실제 Redis 키는 `recruit:hash:city:all`(HASH 타입) / `recruit:city:all`이며 literal `recruit_hash`/`recruit`이 아니다(`recruitKeyManager` prefix 생성).

1. **baseline 선적재 → 일부 해시 필드만 삭제 (전체 삭제 금지)**:
   - a. **1차 부팅** → 첫 DUMMY 크롤이 `startWork()`(지연 0 즉시 1회)로 `recruit:hash:city:all`에 baseline 적재(`NO_DATA`, RECRUIT_NEW 미발행 — 정상). 로그 `No data found. Data cached...` 확인.
   - b. **해시 일부 필드만 삭제**: `redis-cli HKEYS recruit:hash:city:all`로 id 확인 후 1~2개만 `redis-cli HDEL recruit:hash:city:all <id1> <id2>`. ⚠️ 전체 키 삭제(`DEL`) 금지 — `NO_DATA`로 되돌아가 또 미발행.
   - c. **2차 크롤**(재부팅 또는 다음 스케줄 틱) → `diffJobs`가 삭제된 id를 `addedJobs`로 감지 → `CHANGED` → **RECRUIT_NEW 발행**.
2. **구독자 1명 이상 존재**: `users/{userId}/notifications/settings`에 `enabled=true` 구독자 1건 이상 (DM 수신 대상).

**검증 항목**:

| # | 검증 항목 | 방법 | 기대 결과 |
|---|----------|------|----------|
| 1 | 핸들러 등록 | 부팅 로그 | `🔧 Registering event handlers...` + 리스너 수 > 0 |
| 2 | 스케줄러 시작 (Recruit만) | 부팅 로그 | `[recruit] ✅ Scheduler started.` + `✅ Schedulers initialized`, Proxy는 `⏭️ ProxyScheduler skipped` |
| 3 | Discord ready | 부팅 로그 | `onReady`의 `Ready! Logged in as <tag>` 도착(빗장 열림) — 스케줄러 시작과 순서 무관 |
| 4 | HTTP 비결합 (음성 검증) | 잘못된 토큰으로 부팅 후 HTTP 요청 | `Discord login failed (HTTP unaffected)` 로그만, HTTP 200 응답 유지(500 아님) |
| 5 | RECRUIT_NEW 발행 | **2차 크롤**(부분 해시 삭제 후) 로그 | `setRecruitList` `CHANGED` 분기 → `RECRUIT_NEW` 발행. (1차 크롤은 `NO_DATA`로 미발행 — 정상) |
| 6 | 구독자 알림 → 실제 DM | Discord DM 수신 | 대상 사용자에게 DM **1건 실수신** (dmSender가 발송 직전 `getDiscordReady()` 대기 후 fetch) |
| 7 | NOTIFICATION_SENT | 로그 | `NOTIFICATION_SENT` (또는 dmSender `ok:true`) 로그 — `max_retries` 실패 없음 |
| 8 | ready race 해소 | 첫 크롤이 ready보다 빨라도 DM 1건 수신 | 발송 직전 게이트(§2.7)로 유실 없음 (ready 전 fetch → max_retries 실패 미발생) |
| 9 | graceful shutdown | Ctrl+C | `🛑 Shutting down schedulers...` → `All schedulers stopped.` |

> 항목 4(음성 검증)는 선택 — 정상 토큰 경로 검증이 우선. 실패 항목은 `03-analysis.md` 갭으로 등재 후 `/pdca iterate`.

---

## 7. 알림 임베드 UX 개편 (iterate 보강 — 2026-07-24)

> **배경**: 6.2 로컬 E2E의 임베드 렌더 검증(모바일)에서 발견한 UX 문제를 iterate로 반영. 1.9가 책임지는 "알림 출력물"의 가독성 개선. `notificationMessageEmbed.ts` 개편 + `NotificationSendHandler`의 content/footer 생성 연동. 프로토타입(로컬 실 DM 반복 발송)으로 문구·레이아웃·아이콘 확정.

### 7.1 확정 스펙

**message.content (푸시 배너용 — 평문 개행이 배너에 유지됨, 실측 확인)**:
```
📢 {지역요약} · 총 {N}건          ← SELECTED: 지역 라벨(예 "서울·부산·대전") / ALL: "전체 지역"
⎵▽ 아래 목록에서 확인하세요        ← 앞 공백 1칸, ▽(모노크롬 텍스트 심볼)
```

**embed**:
- **헤더(title/description) 없음** — content가 헤더 역할(중복 제거). `setColor(0x00b0f4)` + `setTimestamp()`만.
- **description** = 상위 3건(`TOP_COUNT=3`), 블록 사이 빈 줄 1개(`\n\n` join):
  ```
  {i}. [제목](baseUrl+jobId)
  📅 {날짜: 시작 ~ 종료, 시간(00:00/23:59) 제거}
  ⏳ {D-day} · 🏷️ {상태}
  ```
- **오버플로**(공고 > 3건): description 마지막 블록으로
  ```
  ▸ 이 외 {N-3}건 더 있어요 · [전체 공고 확인하러 가기](baseUrl)
  ```
  - `▸`는 모노크롬 텍스트 심볼(컬러 이모지 `➕`는 검게 보여 배제).
  - 링크 = `baseUrl`(=`ENV.SRIA_URL`) **그대로**. 사이트가 다중 지역 필터를 지원하지 않으므로 항상 전체 공고 목록으로 연결.
- **안내문** (`alertMode === SELECTED` **그리고** 오버플로 존재 시에만) — description 하단에 2줄로:
  ```
  지역 필터로 조회된 공고예요
  전체 공고에는 다른 지역도 포함돼요
  ```
  - ⚠️ Discord embed `footer.text`는 개행(`\n`)을 지원하지 않으므로 **footer가 아니라 description 하단 블록**으로 넣는다(블록 사이 빈 줄 1개). 타임스탬프는 `setTimestamp()`로 유지 → 안내문 아래 `•{시각}` 라인.
  - ALL 모드는 지역 필터가 없어 안내문 생략.

### 7.2 데이터·연동

- 소스: `NotificationSendEvent.settings`(이미 페이로드에 존재 — `alertMode` / `regions`). 임베드 시그니처를 `notificationMessageEmbed(jobs, settings)`로 확장.
- 지역 라벨: `providers/discord/builder/buttons/formatRegionList` + `common/constants/city.ts`(CityEn→한글) 재사용.
- content(배너 요약) 생성은 핸들러(`NotificationSendHandler`)에서 `settings`로 조립 후 `sendNotificationDM({ content, embeds:[embed] })`.

### 7.3 동작 변경

| 항목 | 기존 | 변경 |
|------|------|------|
| 오버플로 임계 | `>= 6`(`OVERFLOW_THRESHOLD`) | **`> 3`**(TOP_COUNT 초과) |
| 필드 구성 | `addFields`(제로폭 name → 상단 빈 줄) | **description 단일 문자열**(상단 빈 줄 제거) |
| 배너 텍스트 | content 없음(임베드 제목만 노출) | **content 2줄 요약**(배너 개행 유지) |

### 7.4 검증 완료(프로토타입 로컬 실 DM)

- content 평문 개행이 **푸시 배너에 유지됨** 확인 → `[[discord-push-banner-newlines]]`.
- footer 렌더, `▽`/`▸` 모노크롬 렌더, 날짜 시간 제거, ALL/SELECTED 분기 확인.
- (별도) dmSender 10013 Unknown User 실패 경로 PASS(§6.2 관련) — `{ ok:false, reason:"unknown_user", errorCode:10013, attempts:1 }`.

### 7.5 구현 메모

- `recruitMessageEmbed.ts`와의 DRY(1.8 이월 W1)도 이때 함께 검토 가능(공통 블록 헬퍼).
- `jobLink.formatJobTitleLink`(제목 링크), `trimDate`(신규 헬퍼) 사용.

---

*작성일: 2026-06-12*
*수정: 2026-06-14 — C안 반영 (ready 게이트 위치 = dmSender 발송 직전, §2.7 신설). Validator Critical(ready race) 해소.*
*수정: 2026-07-24 — §7 알림 임베드 UX 개편 iterate 보강(로컬 렌더 검증 발견 개선 확정 스펙).*
*참고: docs/phase-1-9/01-plan.md*

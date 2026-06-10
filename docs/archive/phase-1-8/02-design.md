# Phase 1.8 설계서: Discord DM 발송 유틸리티

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-8/01-plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

> 이 프로젝트는 단일 UI(Discord)만 존재하며, 실제 경로는 `providers/discord`, `events/bus`이다(템플릿 예시 경로 아님).

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Providers (`functions/src/providers/discord/`) | **신규** `utils/dmSender.ts` (`sendNotificationDM` + `DmSendResult`), **신규** `builder/embeds/notificationMessageEmbed.ts`, **신규** `builder/embeds/jobLink.ts`(공용 링크 헬퍼), **수정** `builder/embeds/recruitMessageEmbed.ts`(private `extractJobId` 제거 → 헬퍼 사용) |
| EventBus Handlers (`functions/src/events/bus/handlers/`) | **신규** `NotificationSendHandler.ts` (`registerNotificationSendHandlers()` — `NOTIFICATION_SEND` 소비 → 임베드 빌드 → DM 전송 → `NOTIFICATION_SENT` 발행) |
| EventBus Utils (`functions/src/events/bus/utils/`) | **수정** `registerEventHandlers.ts` (등록 호출 1줄 추가 — **startup 실제 호출·client 로그인은 Phase 1.9 위임**) |
| Types (`functions/src/events/bus/types.ts`) | **변경 없음** (`NotificationSendEvent`/`NotificationSentEvent` 기존 재사용) |
| Logging (`functions/src/common/utils/systemLogger.ts`) | **변경 없음** (`providerLogger` 재사용) |
| 문서 (`functions/src/providers/CLAUDE.md`) | **수정 방향만 §5 명기** (실제 수정은 do 단계 — embeds 기반 + `providerLogger`로 드리프트 정정) |

### 1.2 컴포넌트 다이어그램

```
[NotificationService]                  (services 계층 — 1.7, 변경 없음)
   │  eventBus.emitEvent(NOTIFICATION_SEND, { userId, jobs, settings })
   ▼
[EventBus] ──────────────────────────────────────────────┐
   │  onEvent(NOTIFICATION_SEND)                          │
   ▼                                                      │
[NotificationSendHandler]            (events/bus/handlers — 신규)
   │  ① notificationMessageEmbed(jobs)  ──► [notificationMessageEmbed] (providers/builder)
   │                                              │ jobLink 헬퍼 사용
   │                                              ▼
   │                                        [jobLink.ts] (공용 헬퍼 — recruitMessageEmbed도 공유)
   │  ② sendNotificationDM(userId, { embeds }) ──► [dmSender] (providers/discord/utils)
   │                                              │  client.users.fetch → user.send
   │                                              │  재시도·429·50007·10013 처리
   │                                              ▼ DmSendResult
   │  ③ eventBus.emitEvent(NOTIFICATION_SENT, { userId, jobCount, success })
   ▼
[EventBus] (NOTIFICATION_SENT — 1.9+ 소비자 대상, 본 Phase는 발행만)
```

**계층 규칙 (계약)**: `dmSender`(providers)는 services/features를 참조하지 않는다. 조율(임베드 빌드 → 전송 → 결과 이벤트 발행)은 **events 핸들러**가 담당한다. 임베드는 호출 측(핸들러)이 빌더로 완성하여 전달하므로 `dmSender`는 포맷을 알지 못한다.

---

## 2. 상세 설계

> **§2의 1순위 안건은 "시그니처 고정"이다.** `sendNotificationDM`은 후속 4개 Phase(1.9/1.10/2.1/2.2)의 계약이므로 **embeds 기반 포맷 무관** 형태로 아래에 명시적으로 고정한다.

### 2.1 dmSender.ts — `sendNotificationDM` (계약 고정 ⭐)

**파일**: `functions/src/providers/discord/utils/dmSender.ts`

**인터페이스/타입 정의 (확정 계약 — 변경 시 4개 Phase 영향)**:

```typescript
import type { MessagePayload, MessageCreateOptions } from "discord.js";

/**
 * DM 발송 페이로드 — 포맷 무관(format-agnostic).
 * 호출 측이 빌더로 완성한 embeds/content를 그대로 전달한다.
 * 포맷(title/recruits 등)을 시그니처에 박지 않는다.
 */
export interface DmPayload {
  /** 완성된 임베드 배열 (호출 측 빌더 산출물, 예: notificationMessageEmbed). */
  embeds?: MessageCreateOptions["embeds"]; // = APIEmbed | JSONEncodable<APIEmbed> ... 배열
  /** 임베드 대신/병행할 평문 메시지. */
  content?: string;
}

/**
 * DM 발송 결과 — 성공 / graceful skip / 실패 3분기.
 * 호출 측(핸들러)이 NOTIFICATION_SENT 발행 여부·success 플래그를 판정하는 데 사용.
 */
export interface DmSendResult {
  /** 전송 성공 여부. skip(=차단)도 success=false, skipped=true로 구분. */
  ok: boolean;
  /** DM 차단/공유 길드 없음(50007) 등 "보낼 수 없는 정상 상태" → 재시도·에러 아님. */
  skipped?: boolean;
  /** ok=false일 때 사유 코드/요약 (예: "dm_disabled" | "unknown_user" | "max_retries"). */
  reason?: string;
  /** Discord API 에러 코드 (50007 / 10013 등), 있으면 기록용. */
  errorCode?: number;
  /** 총 소요 시간(ms) — 로깅·관찰용. */
  durationMs: number;
  /** 실제 시도 횟수. */
  attempts: number;
}

export async function sendNotificationDM(
  userId: string,
  payload: DmPayload
): Promise<DmSendResult>;
```

**고정 시그니처 요약 (4개 Phase 계약)**:

```
sendNotificationDM(userId: string, payload: { embeds?; content? }): Promise<DmSendResult>
```

- 포맷(title/recruits)을 **시그니처에 박지 않는다**. 임베드는 호출 측이 빌더로 완성해 전달.
- 반환은 `void`가 아닌 `DmSendResult` — 성공/skip/실패를 호출 측이 구분해 후속 이벤트를 결정.

**상수**:

```typescript
const MAX_ATTEMPTS = 3;             // 최대 시도 횟수 (최초 1 + 재시도 2)
const BASE_BACKOFF_MS = 500;        // 일시 오류 시 짧은 backoff 기준
const ERR_DM_DISABLED = 50007;      // DM 차단 / 공유 길드 없음 → graceful skip
const ERR_UNKNOWN_USER = 10013;     // Unknown User → 재시도 없이 실패
```

**핵심 로직 (pseudo-code)**:

```typescript
export async function sendNotificationDM(userId, payload): Promise<DmSendResult> {
  const startedAt = Date.now();
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: payload.embeds, content: payload.content });

      const durationMs = Date.now() - startedAt;
      providerLogger.info("DM 전송 성공", { userId, durationMs, attempts });
      return { ok: true, durationMs, attempts };

    } catch (error) {
      const code = (error as { code?: number }).code;

      // (1) DM 차단/공유 길드 없음 → 재시도 없이 graceful skip
      if (code === ERR_DM_DISABLED) {
        const durationMs = Date.now() - startedAt;
        providerLogger.warn("DM 전송 skip (DM 차단/공유 길드 없음)", {
          userId, errorCode: code, durationMs, attempts,
        });
        return { ok: false, skipped: true, reason: "dm_disabled", errorCode: code, durationMs, attempts };
      }

      // (2) Unknown User → 재시도 없이 실패
      if (code === ERR_UNKNOWN_USER) {
        const durationMs = Date.now() - startedAt;
        providerLogger.error("DM 전송 실패 (Unknown User)", error as Error, {
          userId, errorCode: code, durationMs, attempts,
        });
        return { ok: false, reason: "unknown_user", errorCode: code, durationMs, attempts };
      }

      // (3) Rate limit → 대기(ms, *1000 금지) 후 재시도
      //     discord.js 14.17 RateLimitError.retryAfter/timeToReset은 밀리초 단위.
      //     RateLimitError는 code가 없으므로 status===429 / name으로도 방어 감지.
      const rateLimitWaitMs = getRateLimitWaitMs(error); // retryAfter/timeToReset(ms) 또는 fallback
      if (rateLimitWaitMs != null) {
        if (attempts >= MAX_ATTEMPTS) break;            // 마지막 시도였으면 실패 처리
        await sleep(rateLimitWaitMs);                   // ms 그대로 — *1000 금지
        continue;
      }

      // (4) 그 외 일시 오류 → 짧은 backoff 후 재시도 (마지막 시도면 break)
      if (attempts >= MAX_ATTEMPTS) break;
      await sleep(BASE_BACKOFF_MS * attempts);          // 선형 backoff
      continue;
    }
  }

  // 재시도 소진 → 실패
  const durationMs = Date.now() - startedAt;
  providerLogger.error("DM 전송 실패 (재시도 소진)", undefined, { userId, durationMs, attempts });
  return { ok: false, reason: "max_retries", durationMs, attempts };
}
```

> `client`는 `@/providers/discord/client`의 싱글톤 export를 직접 import(현재 `export const client = new Client(...)`). client 로그인(ready) 보장은 startup 책임 = **Phase 1.9 위임**. 본 Phase는 client가 로그인되었다는 전제에서 fetch/send만 수행한다.

**에러 처리 원칙**:
- providers 계층은 **graceful degradation** — 예외를 throw하지 않고 `DmSendResult`로 흡수해 반환한다 (조율 계층이 결과로 판단).
- `console.log` 금지 — 성공(info)·skip(warn)·실패(error) 모두 `providerLogger`로만 기록.
- **rate limit 대기 단위 = 밀리초(ms)**: discord.js 14.17 `RateLimitError.retryAfter`/`timeToReset`은 ms 단위다 — 원시 HTTP의 `retry_after`(초)와 달라 **`*1000` 보정 금지**. RateLimitError는 `code`가 없으므로 `retryAfter`/`timeToReset`(ms) → `status===429`/`name==="RateLimitError"` fallback 순으로 감지한다(`getRateLimitWaitMs` 헬퍼). 기본 설정(`rejectOnRateLimit: null`)에선 REST 내부 큐가 흡수해 실제 throw는 드물다. (do 단계 검증: 14.17.3 타입 정의 직접 확인 완료)

### 2.2 notificationMessageEmbed.ts — 알림 전용 임베드 빌더

**파일**: `functions/src/providers/discord/builder/embeds/notificationMessageEmbed.ts`

**인터페이스**:

```typescript
import type { APIEmbed } from "discord.js";
import type { Job } from "@/common/types/job.d";

/** 새 공고 알림 DM용 임베드. "🔔 새로운 채용 공고" 헤더. */
export function notificationMessageEmbed(jobs: Job[]): APIEmbed;
```

**핵심 로직 (pseudo-code)**:

```typescript
export function notificationMessageEmbed(jobs: Job[]): APIEmbed {
  const baseUrl = ENV.SRIA_URL;
  const embed = new EmbedBuilder()
    .setTitle("🔔 새로운 채용 공고")
    .setDescription(`총 ${jobs.length}건의 새로운 공고가 등록되었어요.`)
    .setColor(0x00b0f4)
    .setTimestamp();

  jobs.forEach((job, index) => {
    const r = job.value;                          // Job.value: RecruitData
    const titleLine = formatJobTitleLink(r.title, r.href, baseUrl); // §2.3 공용 헬퍼
    embed.addFields({
      name: "\n",
      value: `${index + 1}. ${titleLine}\n📅 ${r.dayTxt} | ⏱ ${r.dDay} | 🏷️ 상태: ${r.recruitmentStatus}`,
    });
  });

  return embed.toJSON();
}
```

> 입력은 `Job[]`(이벤트 페이로드 타입과 일치). `Job.value`가 `RecruitData`이므로 링크/필드는 `recruitMessageEmbed`와 동일 포맷을 공유한다. 표시 건수 상한(전체 vs 상위 N)·footer 정책은 do 단계에서 Frontend Architect와 확정(설계상은 매칭 공고가 보통 소수라 전체 표시 기본).

**에러 처리**: 빌더는 순수 함수 — 외부 I/O 없음. 빈 배열 방어는 호출 측(핸들러)이 `jobs.length === 0` 시 발송 자체를 건너뛴다.

### 2.3 jobLink.ts — 공용 링크 헬퍼 (DRY 추출)

**파일**: `functions/src/providers/discord/builder/embeds/jobLink.ts`

**인터페이스**:

```typescript
/** href("/jobs/12345")에서 jobId("12345") 추출. 매치 실패 시 "". */
export function extractJobId(path: string): string;

/**
 * 공고 제목을 마크다운 링크로 포맷.
 * baseUrl 없으면 링크 없이 제목만 반환(기존 recruitMessageEmbed 동작 동일).
 */
export function formatJobTitleLink(title: string, href: string, baseUrl?: string): string;
```

**핵심 로직 (pseudo-code)** — `recruitMessageEmbed`의 기존 로직을 **순수 추출**(동작 동일 유지):

```typescript
export function extractJobId(path: string): string {
  const match = path.match(/\/jobs\/(\d+)/);
  return match ? match[1] : "";
}

export function formatJobTitleLink(title: string, href: string, baseUrl?: string): string {
  return baseUrl ? `[${title}](${baseUrl}${extractJobId(href)})` : title;
}
```

> 기존 `recruitMessageEmbed`의 인라인 표현 `[${item.title}](${baseUrl}${extractJobId(item.href)})`를 그대로 `formatJobTitleLink`로 캡슐화한다. baseUrl 분기 동작도 동일. **동작 변경 없음**이 추출의 계약.

### 2.4 recruitMessageEmbed.ts — 헬퍼 사용으로 리팩터링 (수정)

**파일**: `functions/src/providers/discord/builder/embeds/recruitMessageEmbed.ts`

**변경 내용**:
- 파일 상단 private `function extractJobId(path)` **제거**.
- `jobLink.ts`에서 `formatJobTitleLink`(또는 `extractJobId`) import.
- 필드 생성부 `titleLine` 계산을 헬퍼 호출로 교체:

```typescript
import { formatJobTitleLink } from "./jobLink";
// ...
const titleLine = formatJobTitleLink(item.title, item.href, baseUrl);
```

**계약**: 출력 임베드 JSON은 변경 전과 **바이트 동일** 수준으로 유지(순수 추출). 컴파일 + 시각 확인으로 검증(§6).

### 2.5 NotificationSendHandler.ts — 소비 핸들러 (신규)

**파일**: `functions/src/events/bus/handlers/NotificationSendHandler.ts`

**인터페이스**:

```typescript
/**
 * NOTIFICATION_SEND 소비 핸들러 등록 (Phase 1.8).
 * NOTIFICATION_SEND → 임베드 빌드 → sendNotificationDM → NOTIFICATION_SENT 발행.
 */
export function registerNotificationSendHandlers(): void;
```

**핵심 로직 (pseudo-code)** — 1.7 `NotificationEventHandler` 패턴과 대칭(내부 try-catch + 재throw 금지 + `globalLogger`):

```typescript
import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { eventBus, EventType } from "@/events/bus";
import type { NotificationSendEvent, NotificationSentEvent } from "@/events/bus";
import { notificationMessageEmbed } from "@/providers/discord/builder/embeds/notificationMessageEmbed";
import { sendNotificationDM } from "@/providers/discord/utils/dmSender";

export function registerNotificationSendHandlers(): void {
  eventBus.onEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, async (payload) => {
    try {
      if (payload.jobs.length === 0) return;

      const embed = notificationMessageEmbed(payload.jobs);
      const result = await sendNotificationDM(payload.userId, { embeds: [embed] });

      // skip(차단)도 success=false로 발행 — 1.9+ 소비자가 결과를 관찰
      eventBus.emitEvent<NotificationSentEvent>(EventType.NOTIFICATION_SENT, {
        timestamp: Date.now(),
        source: "NotificationSendHandler",
        userId: payload.userId,
        jobCount: payload.jobs.length,
        success: result.ok,
        // result.ok=false일 때만 error 표기(skip은 정상 상태이므로 error 미부여 고려 — do에서 확정)
      });
    } catch (error) {
      // emitter 안정성 — 재throw 금지
      globalLogger.error("알림 발송 핸들러 처리 실패", error as Error, {
        event: EventType.NOTIFICATION_SEND,
        source: "NotificationSendHandler",
      });
    }
  });
}
```

**설계 결정 — `NotificationSentEvent.success` 매핑**:
- `result.ok === true` → `success: true`.
- `result.skipped === true`(DM 차단) → `success: false` (전송은 안 됐으나 시스템 정상). `error` 필드는 부여하지 않음(에러가 아님).
- `result.ok === false && !skipped`(실패) → `success: false`. `error` 필드 부여는 do 단계에서 `NotificationSentEvent.error?: Error` 형태에 맞춰 확정(현재 페이로드는 `error?: Error` 옵셔널).

**에러 처리**:
- `dmSender`가 이미 graceful하게 `DmSendResult`를 반환하므로, 핸들러의 try-catch는 빌더 예외·예기치 못한 throw에 대한 **2차 안전망**.
- 재throw 금지 — EventBus emitter로 예외가 전파되면 다른 리스너·프로세스 안정성을 해친다(1.7 패턴 동일).

### 2.6 registerEventHandlers.ts — 등록 연결 (수정, 1.9 경계 준수)

**파일**: `functions/src/events/bus/utils/registerEventHandlers.ts`

**변경 내용** — `registerAllEventHandlers()` 내부에 **등록 호출 1줄만** 추가:

```typescript
import { registerNotificationSendHandlers } from "../handlers/NotificationSendHandler";
// ...
export function registerAllEventHandlers(): void {
  // ... (기존)
  registerNotificationHandlers();        // 1.7 (기존)

  // Phase 1.8: NOTIFICATION_SEND 소비 핸들러 (DM 발송)
  registerNotificationSendHandlers();    // ← 추가
  // ...
}
```

> **⚠️ 1.9 경계 명시 (CTO 리스크 반영)**: 본 Phase는 `registerAllEventHandlers()` 내부에 **핸들러 등록 연결만** 추가한다.
> - `registerAllEventHandlers()`를 **startup(app 진입점)에서 실제 호출**하는 것 → **Phase 1.9**.
> - **Discord client 로그인(`client.login`)·ready 보장** → **Phase 1.9**.
> 즉 1.8 종료 시점에는 "핸들러가 등록되도록 배선만 완료"되며, 실제 DM이 나가려면 1.9의 startup wiring이 필요하다. design은 이 경계를 침범하지 않는다.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

해당 없음 — 본 Phase는 Firestore 읽기/쓰기 없음(구독자 조회는 1.7 `NotificationService` 책임, 본 Phase는 이미 발행된 `NOTIFICATION_SEND`만 소비).

### 3.2 이벤트 페이로드 (기존 타입 재사용 — 신규 정의 없음)

| 이벤트 타입 | 방향 | 페이로드 | 발행/소비 시점 |
|------------|------|---------|---------------|
| `NOTIFICATION_SEND` (`notification:send`) | **소비** | `NotificationSendEvent { timestamp, source?, userId, jobs: Job[], settings: AlarmSubscription }` | 1.7 `NotificationService.notifyNewRecruits`가 구독자별 발행 → 본 Phase 핸들러가 소비 |
| `NOTIFICATION_SENT` (`notification:sent`) | **발행** | `NotificationSentEvent { timestamp, source?, userId, jobCount, success, error? }` | 본 Phase 핸들러가 DM 전송(또는 skip/실패) 후 발행. 소비자는 1.9+ (본 Phase는 발행만) |

**페이로드 매핑 (핸들러 내부)**:

| `NotificationSentEvent` 필드 | 값 |
|------------------------------|-----|
| `timestamp` | `Date.now()` |
| `source` | `"NotificationSendHandler"` |
| `userId` | `payload.userId` |
| `jobCount` | `payload.jobs.length` |
| `success` | `DmSendResult.ok` (skip·실패 모두 `false`) |
| `error?` | 실패 시에만 부여 검토(skip은 미부여) — do 단계 확정 |

> `DmSendResult`(§2.1)는 **provider 내부 반환 타입**이며 EventBus 페이로드가 아니다. 신규 이벤트 타입을 정의하지 않는다(범위 제외 준수).

---

## 4. 구현 순서

> **시그니처 우선 고정 → 병렬 가능.** 1번(계약 고정) 완료 후 Discord 영역(2~4)과 Integration 영역(5~6)을 병렬 진행할 수 있다.

| 순서 | 작업 | 파일 | 병렬 | 설계 섹션 |
|------|------|------|------|----------|
| 1 | **`DmSendResult`/`DmPayload` 타입 + `sendNotificationDM` 시그니처 고정** (계약 — 최우선) | `providers/discord/utils/dmSender.ts` | — | §2.1 |
| 2 | `jobLink.ts` 공용 헬퍼 추출 (순수) | `providers/discord/builder/embeds/jobLink.ts` | 🟢 A | §2.3 |
| 3 | `recruitMessageEmbed` 헬퍼 사용으로 교체 | `providers/discord/builder/embeds/recruitMessageEmbed.ts` | 🟢 A (2 의존) | §2.4 |
| 4 | `notificationMessageEmbed` 빌더 + `sendNotificationDM` 본문 구현 | `notificationMessageEmbed.ts`, `dmSender.ts` | 🟢 A | §2.1, §2.2 |
| 5 | `NotificationSendHandler` 구현 (NOTIFICATION_SEND 소비 → DM → SENT 발행) | `events/bus/handlers/NotificationSendHandler.ts` | 🔵 B (1 시그니처 의존) | §2.5 |
| 6 | `registerEventHandlers`에 등록 연결 1줄 (startup 호출 X — 1.9) | `events/bus/utils/registerEventHandlers.ts` | 🔵 B | §2.6 |
| 7 | `providers/CLAUDE.md` dmSender 예시 드리프트 정정 (코드-문서 동시) | `providers/CLAUDE.md` | — | §5 |
| 8 | TypeScript 컴파일 검증 (baseline 외 신규 에러 0건) | 전체 | — | §6 |

> 🟢 A = Discord Agent 영역 / 🔵 B = Integration Lead 영역. 접점은 `sendNotificationDM` 시그니처 1개(순서 1)뿐 → 고정 후 A·B 동시 진행.

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 인터페이스/타입 (`DmSendResult`, `DmPayload`)
- [ ] **`console.log` 금지** → `providerLogger`(LogSource `provider`)로 성공(info)/skip(warn)/실패(error) 기록
- [ ] 핸들러 로깅은 `globalLogger`(1.7 패턴 대칭, `import "@/common/utils/systemLogger"` 선행)
- [ ] EventBus 타입 안전 메서드(`emitEvent<T>`/`onEvent<T>`) + `EventType` enum 사용
- [ ] 핸들러 내부 try-catch + **재throw 금지**(emitter 안정성)
- [ ] providers 계층 의존성 규칙: `dmSender` → services/features 참조 금지
- [ ] 신규 이벤트 타입 정의 금지(기존 `NotificationSendEvent`/`NotificationSentEvent` 재사용)
- [ ] JSDoc 주석(공개 API: `sendNotificationDM`, `DmSendResult`, 빌더, 헬퍼)
- [ ] 한국어 사용자 대면 문자열("🔔 새로운 채용 공고" 등)

### 5.1 `providers/CLAUDE.md` 드리프트 정정 방향 (실제 수정은 do 단계)

현재 `functions/src/providers/CLAUDE.md`의 `dmSender.ts` 예시가 확정 계약과 **모순** → do 단계에서 코드와 함께 정정:

| 현재(드리프트) | 정정 방향 |
|---------------|----------|
| `sendNotificationDM(userId, { title, recruits, color })` — **포맷이 시그니처에 박힘** | `sendNotificationDM(userId, { embeds?, content? }): Promise<DmSendResult>` — **포맷 무관** (§2.1 확정 계약) |
| `console.log` / `console.error` 사용 | `providerLogger.info/warn/error` 사용 (LogSource `provider`) |
| `Promise<void>` 반환 | `Promise<DmSendResult>` 반환(성공/skip/실패 구분) |
| `sendBulkNotifications` + `setTimeout(1000)` 순차 발송 예시 | 구독자 간 간격은 discord.js v14 REST 내장 큐에 위임 — bulk 헬퍼는 본 Phase 범위 아님(예시 제거/축약). 순차 발송 비용은 §리스크 + 1.9 실측 이월 |
| `error.code === 50007`만 처리 | 50007(graceful skip) + 10013(실패) + rate limit(ms 대기, RateLimitError는 code 없음) 명시 |

---

## 6. 테스트 계획

> Phase 3 테스트 프레임워크 도입 전 — **수동/컴파일 검증**. 런타임 E2E(실제 DM 전송)는 startup wiring 의존이므로 **Phase 1.9 이월**(메모리 `dm-e2e-test-phase-sequence` 일치).

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 전체 컴파일 | `tsc` / `npm run build` | baseline 외 신규 에러 0건 |
| `sendNotificationDM` 시그니처 고정 | 타입 확인 (`DmPayload`/`DmSendResult`) | embeds 기반 포맷 무관, `Promise<DmSendResult>` 반환 |
| `recruitMessageEmbed` 동작 동일 | 헬퍼 추출 전/후 임베드 JSON 비교(수동 diff) | 출력 변경 없음 |
| `notificationMessageEmbed` 산출 | 샘플 `Job[]`로 호출 → JSON 육안 확인 | "🔔 새로운 채용 공고" 헤더 + 공고 필드/링크 정상 |
| 핸들러 등록 연결 | `registerAllEventHandlers()` 코드상 호출 확인 | `registerNotificationSendHandlers()` 1줄 추가, startup 호출은 미포함(1.9) |
| 에러 분기 (로직 검토) | 코드 리뷰 | 50007 skip / 10013 실패 / rate limit ms 대기(*1000 금지) / 미지 코드 backoff 재시도 |
| 컨벤션 | 코드 리뷰 / Code Analyzer | `console.log` 0건, `providerLogger`/`globalLogger` 사용 |
| **런타임 DM 전송 E2E** | **(이월)** | **Phase 1.9 startup wiring 후 실제 DM 수신 확인** |

### 6.1 1.9 이월 명시 (런타임 검증 불가 사유)

본 Phase는 `registerAllEventHandlers()`의 **startup 호출과 client 로그인을 포함하지 않으므로**(1.9 경계) 정적 검증(컴파일·코드 리뷰)까지만 가능하다. 실제 DM 전송 검증은 1.9 통합 시 수행한다.

### 6.2 리스크/비고 (do·analyze 참고)

- **순차 발송 + `setTimeout` 블로킹**: 핸들러는 구독자별 `NOTIFICATION_SEND` 단위로 독립 호출되나, 429 시 `retry_after` 대기(`sleep`)가 해당 핸들러 실행을 블로킹한다. 다수 구독자·rate limit 누적 시 함수 실행시간·비용에 영향 → **실측은 1.9 E2E 이월**(plan §리스크 3). 교차 사용자 throttle/중앙 큐는 본 Phase 범위 제외.
- **client ready 전제**: dmSender는 client 로그인 완료를 전제한다. 미로그인 상태 호출 시 fetch 실패 → 1.9 startup이 ready 보장.

---

*작성일: 2026-06-10*
*참고: docs/phase-1-8/01-plan.md*
*게이트: CTO Lead design 위임안 반영 (Discord Agent 단독 작성 §1~§6, NotificationSendHandler는 Integration Lead 추후 검토)*

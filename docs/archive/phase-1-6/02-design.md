# Phase 1.6 설계서: 공고 요청 기능 개선 (recruit-request-enhancement)

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-6/01-plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Events Bus (`functions/src/events/bus/`) | `EventType` 추가, 이벤트 인터페이스 재정의·신규 추가, `EventPayloadMap` 확장 |
| Services (`functions/src/services/`) | `RecruitService.getRecruitList()` 반환 타입 확장 (`{ data, tier, durationMs }`) |
| Event Listeners (`functions/src/events/listeners/`) | `onRecruitRequest` 핸들러에 이벤트 발행 추가 |
| Schedulers (`functions/src/crawlers/schedulers/`) | `RecruitScheduler` — 반환 타입 변경 대응 (구조분해) |
| Test Routes (`functions/src/test/`) | `routes.ts` — 반환 타입 변경 대응 (구조분해) |

### 1.2 컴포넌트 다이어그램

```
[Discord /recruit-request]
        │
        ▼
[onRecruitRequest] ──emit──► [EventBus] ──► RECRUIT_REQUESTED
        │
        ▼
[RecruitService.getRecruitList()]
        │  반환: { data, tier, durationMs }
        │
   ┌────┴────────────────────────┐
   │  Redis → Firestore → Crawl  │  (3-tier 캐싱)
   └────┬────────────────────────┘
        │
        ▼
[onRecruitRequest] ──emit──► [EventBus] ──► RECRUIT_REQUEST_COMPLETED
        │                                     (jobs: RecruitData[] 포함)
        ▼
[interaction.editReply()]   ← 기존 로직 유지
```

---

## 2. 상세 설계

### 2.1 이벤트 타입 정의 (`events/bus/types.ts`)

**파일**: `functions/src/events/bus/types.ts`

**추가 import**:
```typescript
import type { CRAWL_MODE } from "@/common/constants";
import type { RecruitData } from "@/crawlers/types";
```

**EventType 추가**:
```typescript
export enum EventType {
  // ...기존 항목...
  RECRUIT_REQUESTED = "recruit:requested",         // 기존 유지
  RECRUIT_REQUEST_COMPLETED = "recruit:request:completed", // 신규 추가
}
```

**인터페이스 재정의 / 신규**:
```typescript
// 재정의: jobs 제거, mode 추가 — "시작" 시맨틱
export interface RecruitRequestedEvent extends BaseEvent {
  userId: string;
  region?: CityEn;
  mode: CRAWL_MODE;
}

// 신규: Fat event — "완료" 시맨틱, 조회 결과 포함
export interface RecruitRequestCompletedEvent extends BaseEvent {
  userId: string;
  region?: CityEn;
  mode: CRAWL_MODE;
  jobs: RecruitData[];   // 빈 배열 가능 (empty/error 경우)
  tier: "redis" | "firestore" | "crawler" | "empty" | "error";
  durationMs: number;
}
```

**EventPayloadMap 확장**:
```typescript
export interface EventPayloadMap {
  // ...기존 항목...
  [EventType.RECRUIT_REQUESTED]: RecruitRequestedEvent;
  [EventType.RECRUIT_REQUEST_COMPLETED]: RecruitRequestCompletedEvent; // 신규
}
```

**에러 처리**: 타입 레이어이므로 런타임 에러 없음. `import type`으로 CRAWL_MODE·RecruitData 참조.

---

### 2.2 서비스 반환 타입 확장 (`services/recruitService.ts`)

**파일**: `functions/src/services/recruitService.ts`

**시그니처 변경**:
```typescript
// Before
async getRecruitList(mode: CRAWL_MODE, city?: string): Promise<RecruitData[] | null>

// After
async getRecruitList(
  mode: CRAWL_MODE,
  city?: string
): Promise<{ data: RecruitData[] | null; tier: "redis" | "firestore" | "crawler" | "empty"; durationMs: number }>
```

**내부 변경 핵심**:
```typescript
async getRecruitList(mode, city) {
  const startedAt = Date.now();
  // ...
  // Redis hit
  const cached = await this.cacheService.getRecruitList(...);
  if (cached) {
    return { data: await getCityFilteredList(mode, convertedCity, cached), tier: "redis", durationMs: Date.now() - startedAt };
  }
  // Firestore hit
  const firestoreData = await this.firestore.getRecruitList();
  if (firestoreData) {
    return { data: await getCityFilteredList(mode, convertedCity, firestoreData), tier: "firestore", durationMs: Date.now() - startedAt };
  }
  // Crawling
  const crawled = await this.collectAndSaveRecruits(mode, ...);
  if (!crawled) {
    return { data: null, tier: "empty", durationMs: Date.now() - startedAt };
  }
  return { data: await getCityFilteredList(mode, convertedCity, crawled), tier: "crawler", durationMs: Date.now() - startedAt };
}
```

> `getCityFilteredList`는 async 함수이므로 객체 리터럴 내부에서 `await` 필수.

**에러 처리**: `HttpError.TooManyRequests` throw는 유지 — 호출자(`onRecruitRequest`)의 catch에서 이벤트 발행 후 사용자에게 에러 메시지.

---

### 2.3 이벤트 발행 주체 (`onRecruitRequest.ts`)

**파일**: `functions/src/events/listeners/commands/onRecruitRequest.ts`

**핵심 로직**:
```typescript
export async function onRecruitRequest(interaction: CommandInteraction) {
  await interaction.deferReply();
  // ...지역 검증 (기존과 동일)...

  const userId = interaction.user.id;
  const startedAt = Date.now();

  // 시작 이벤트 (발행 실패 → 비즈니스 로직 계속)
  try {
    eventBus.emitEvent<RecruitRequestedEvent>(EventType.RECRUIT_REQUESTED, {
      timestamp: startedAt, source: "onRecruitRequest",
      userId, region: region as CityEn | undefined, mode: CRAWL_MODE.DUMMY,
    });
  } catch (e) {
    globalLogger.error("이벤트 발행 실패", e as Error, { event: EventType.RECRUIT_REQUESTED });
  }

  try {
    const recruitService = new RecruitService();
    const { data, tier, durationMs } = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, region);

    // 완료 이벤트 (발행 실패 → 사용자 응답 계속)
    try {
      eventBus.emitEvent<RecruitRequestCompletedEvent>(EventType.RECRUIT_REQUEST_COMPLETED, {
        timestamp: Date.now(), source: "onRecruitRequest",
        userId, region: region as CityEn | undefined, mode: CRAWL_MODE.DUMMY,
        jobs: data ?? [], tier, durationMs,
      });
    } catch (e) {
      globalLogger.error("이벤트 발행 실패", e as Error, { event: EventType.RECRUIT_REQUEST_COMPLETED });
    }

    // 기존 응답 로직 유지
    if (!data || data.length === 0) {
      await interaction.editReply(`❌ \`${region}\` 지역에 대한 공고가 없어요.`);
      return;
    }
    await interaction.editReply({ embeds: [recruitMessageEmbed(data, region)] });

  } catch (error) {
    // 에러 경로: tier: "error", jobs: []
    try {
      eventBus.emitEvent<RecruitRequestCompletedEvent>(EventType.RECRUIT_REQUEST_COMPLETED, {
        timestamp: Date.now(), source: "onRecruitRequest",
        userId, region: region as CityEn | undefined, mode: CRAWL_MODE.DUMMY,
        jobs: [], tier: "error", durationMs: Date.now() - startedAt,
      });
    } catch (e) { /* swallow */ }

    if (error instanceof Error) globalLogger.error("onRecruitRequest Error:", error);
    await interaction.editReply("⚠️ 공고 요청 처리 중 오류가 발생했어요.");
  }
}
```

**에러 처리 패턴**: 이벤트 발행 try-catch는 각각 독립. 발행 실패가 사용자 응답 흐름을 중단시키지 않는다. 기존 `recruitCacheService.ts` 발행 패턴과 동일.

---

### 2.4 호출부 수정 (RecruitScheduler, test/routes.ts)

반환 타입 변경(`Promise<RecruitData[]|null>` → `Promise<{data, tier, durationMs}>`)에 따른 구조분해 적용.

**RecruitScheduler.ts**:
```typescript
// Before
const recruitData = await this.recruitService.getRecruitList(this.mode);
// After
const { data: recruitData } = await this.recruitService.getRecruitList(this.mode);
```

**test/routes.ts**:
```typescript
// Before
const recruitList = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, city as string | undefined);
// After
const { data: recruitList } = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, city as string | undefined);
```

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

해당 없음 — Firestore 스키마 변경 없음.

### 3.2 이벤트 페이로드

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| `RECRUIT_REQUESTED` | `{ userId, region?, mode, timestamp, source }` | `getRecruitList` 호출 직전 |
| `RECRUIT_REQUEST_COMPLETED` | `{ userId, region?, mode, jobs, tier, durationMs, timestamp, source }` | 조회 완료 후 (정상/빈결과/에러 모두) |

**tier 값 의미**:
- `"redis"` — Redis 캐시 hit
- `"firestore"` — Firestore fallback hit
- `"crawler"` — 실시간 크롤링
- `"empty"` — 크롤링 결과 없음
- `"error"` — 예외 발생 (getRecruitList throw)

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | 이벤트 타입 정의 (import + enum + interface + PayloadMap) | `events/bus/types.ts` | §2.1 |
| 2 | 서비스 반환 타입 확장 | `services/recruitService.ts` | §2.2 |
| 3 | 호출부 구조분해 수정 | `RecruitScheduler.ts`, `test/routes.ts` | §2.4 |
| 4 | 핸들러 이벤트 발행 추가 | `onRecruitRequest.ts` | §2.3 |
| 5 | TypeScript 컴파일 검증 | — | — |

---

## 5. 코딩 컨벤션 체크리스트

- [x] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [x] SystemLogger 사용 (console.log 금지)
- [x] SystemError 패턴 준수 (HttpError.TooManyRequests 유지)
- [x] EventBus 타입 안전 이벤트 (`emitEvent<T>()` 제네릭)
- [x] 한국어 로그 메시지 (`globalLogger.error("이벤트 발행 실패", ...)`)

---

## 6. 테스트 계획

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 신규 타입 컴파일 | `npx tsc --noEmit` | 신규 에러 0개 |
| 기존 호출부 호환성 | `npx tsc --noEmit` | RecruitScheduler, routes.ts 에러 없음 |
| `RECRUIT_REQUESTED` 발행 확인 | 임시 리스너 등록 후 `/recruit-request` 호출 | 로그에 이벤트 확인 |
| `RECRUIT_REQUEST_COMPLETED` 발행 확인 | 동상 | `tier` 값 (redis/firestore/crawler) 및 `jobs` 배열 확인 |
| 에러 경로 이벤트 | 의도적 에러 유발 | `tier: "error"`, `jobs: []` 발행 확인 |
| 기존 Discord 응답 | 수동 실행 | embed 정상 출력, 지역 필터 동작 |

---

*작성일: 2026-04-30*
*참고: docs/phase-1-6/01-plan.md*

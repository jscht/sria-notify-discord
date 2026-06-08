# Phase 1.7 설계서: 자동 알림 시스템 (auto-notification-system)

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-7/01-plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Routes (`functions/src/routes/`) | 변경 없음 |
| Services (`functions/src/services/`) | **신규** `notificationService.ts` — `RecruitNewEvent` 수신 → 구독자 조회 → 필터 → 구독자별 `NOTIFICATION_SEND` 발행 오케스트레이션 |
| EventBus (`functions/src/events/bus/`) | **신규** `handlers/NotificationEventHandler.ts` — `RECRUIT_NEW` 구독 / **수정** `utils/registerEventHandlers.ts` — 핸들러 등록 활성화(등록만, startup 호출은 1.9) |
| Common Utils (`functions/src/common/`) | **신규** `utils/recruitFilter.ts` — `filterByMode`/`filterByRegion` 순수 함수 (`filterListByCity` 정책 재사용) |
| Types (`functions/src/common/types/`) | 변경 없음 (`Job`/`AlarmSubscription`/`AlertMode`, 이벤트 페이로드 모두 기정의분 재사용) |

> **레이어 의존 방향**: `handler(events) → service(services) → { providers, eventBus, common }`.
> `services → features` 의존 금지 규칙(`services/CLAUDE.md`)을 지키기 위해 필터를 `features/`가 아닌
> `common/utils/`에 배치한다(plan 원안 경로 교정 — SoT 우선순위상 CLAUDE.md > plan).

### 1.2 컴포넌트 다이어그램

```
[recruitCacheService]  --emit(RECRUIT_NEW)-->  [EventBus]
                                                   │
                                                   ▼
                              [NotificationEventHandler]  (events/bus/handlers)
                                  │  try-catch (재throw 금지)
                                  ▼
                  [notificationService.notifyNewRecruits(payload)]  (services)
                       │  getAllActiveSubscribers()  ──▶ [SubscriptionStore]   (providers)
                       │  filterByMode(jobs, sub)     ──▶ [recruitFilter]       (common/utils)
                       ▼
              구독자별 emitEvent<NotificationSendEvent>(NOTIFICATION_SEND)
                                  │
                                  ▼
                              [EventBus]  ──▶ [Phase 1.8 DM sender 가 소비]
```

> **설계 경계 = 이벤트 경계.** Phase 1.7은 `NOTIFICATION_SEND` 발행까지만 담당한다.
> 실제 DM 전송(1.8)과 `registerAllEventHandlers()` startup 호출(1.9)은 범위 밖이므로
> **1.7 단독으로는 DM이 실제 전송되지 않는다**(의도된 설계).

---

## 2. 상세 설계

### 2.1 RecruitFilter (모드/지역 필터 순수 함수)

**파일**: `functions/src/common/utils/recruitFilter.ts` (신규)

**인터페이스/타입 정의**:
```typescript
import type { Job } from "@/common/types/job.d";
import type { AlarmSubscription, CityEn } from "@/common/types";
import { AlertMode } from "@/common/types";
import { toKorean } from "@/common/utils/cityName";

export function filterByRegion(jobs: Job[], regions: CityEn[]): Job[];
export function filterByMode(jobs: Job[], subscription: AlarmSubscription): Job[];
```

**핵심 로직**:
```typescript
/**
 * 지역 필터 (Pure Function)
 *
 * `filterListByCity`(common/utils/getCityFilteredList.ts)와 동일한
 * `title.includes(한글지명)` 정책을 Job[]·복수 지역으로 확장한 어댑터.
 * 정책 출처를 본 JSDoc에 명시하여 드리프트를 방지한다.
 */
export function filterByRegion(jobs: Job[], regions: CityEn[]): Job[] {
  if (regions.length === 0) return [];
  const koreanNames = regions
    .map((r) => toKorean(r))
    .filter((n): n is string => Boolean(n));
  return jobs.filter((job) =>
    koreanNames.some((ko) => job.value.title.includes(ko))
  );
}

/** 모드 필터: ALL → 전체, SELECTED → 지역 매칭만 */
export function filterByMode(jobs: Job[], subscription: AlarmSubscription): Job[] {
  return subscription.alertMode === AlertMode.ALL
    ? jobs
    : filterByRegion(jobs, subscription.regions);
}
```

**설계 결정 (DRY)**:
- `filterListByCity(list: RecruitData[], city?)`는 `RecruitData[]`·단일 city 시그니처라 `Job[]`에 직접 적용 시 `Job.id` 손실 + 복수 지역 처리 불가. 따라서 동일 정책을 `Job[]`·복수 지역에 맞춘 **얇은 어댑터**로 분리하고, 정책 출처를 JSDoc에 명시한다.
- 지역 매칭은 `Job.value.title.includes(toKorean(region))` — `RecruitData`에 구조화된 region 필드가 없어 title 부분문자열 정책 유지(기존과 동일, 알려진 한계).

**에러 처리**: 순수 함수 — 예외 없음. 빈 지역(`regions: []`)은 빈 배열 반환(매칭 0건).

### 2.2 NotificationService (오케스트레이션)

**파일**: `functions/src/services/notificationService.ts` (신규)

**핵심 로직**:
```typescript
import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { SubscriptionStore } from "@/providers/firebase/store/subscription";
import { eventBus, EventType } from "@/events/bus";
import type { RecruitNewEvent, NotificationSendEvent } from "@/events/bus";
import { filterByMode } from "@/common/utils/recruitFilter";

export class NotificationService {
  private readonly subscriptionStore = new SubscriptionStore();

  /**
   * RECRUIT_NEW 수신 → 활성 구독자별 모드/지역 필터 → NOTIFICATION_SEND 발행.
   * 실제 DM 발송은 Phase 1.8 핸들러가 NOTIFICATION_SEND를 소비하여 수행.
   */
  async notifyNewRecruits(payload: RecruitNewEvent): Promise<void> {
    const targetJobs = [...payload.addedJobs, ...payload.updatedJobs];
    if (targetJobs.length === 0) return;

    const subscribers = await this.subscriptionStore.getAllActiveSubscribers();
    for (const sub of subscribers) {
      const matched = filterByMode(targetJobs, sub);
      if (matched.length === 0) continue;

      eventBus.emitEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, {
        timestamp: Date.now(),
        source: "NotificationService",
        userId: sub.userId,
        jobs: matched,
        settings: sub,
      });
    }
  }
}

export const notificationService = new NotificationService();
```

**설계 결정**:
- **잡셋 = `addedJobs + updatedJobs` 합집합** (사용자 확정). 신규 공고뿐 아니라 변경 공고도 알림 대상.
- 생성자에서 리스너 등록 **안 함** — 등록은 핸들러(§2.3)로 분리(테스트 가능성·관심사 분리). 싱글톤 `notificationService` export.
- 구독자별 emit은 동기 루프(소량 가정). 대량화는 후속 Phase 검토(plan 비기능 요구사항).

**에러 처리**: `getAllActiveSubscribers()` 실패 등은 핸들러 try-catch(§2.3)가 흡수한다. `emitEvent`는 동기 호출이라 개별 구독자 발행 실패가 루프를 중단시키지 않는다.

### 2.3 NotificationEventHandler (이벤트 구독)

**파일**: `functions/src/events/bus/handlers/NotificationEventHandler.ts` (신규)

**핵심 로직**:
```typescript
import "@/common/utils/systemLogger";
import { eventBus, EventType } from "@/events/bus";
import type { RecruitNewEvent } from "@/events/bus";
import { notificationService } from "@/services/notificationService";

/** RECRUIT_NEW → notificationService.notifyNewRecruits 연결 */
export function registerNotificationHandlers(): void {
  eventBus.onEvent<RecruitNewEvent>(EventType.RECRUIT_NEW, async (payload) => {
    try {
      await notificationService.notifyNewRecruits(payload);
    } catch (error) {
      globalLogger.error("알림 핸들러 처리 실패", error as Error, {
        event: EventType.RECRUIT_NEW,
        source: "NotificationEventHandler",
      });
    }
  });
}
```

**에러 처리**: 핸들러 내부 try-catch로 EventBus 안정성 확보(emitter로 재throw 금지) — `recruitCacheService`의 발행부 try-catch 패턴과 대칭.

### 2.4 registerEventHandlers (등록 활성화)

**파일**: `functions/src/events/bus/utils/registerEventHandlers.ts` (수정)

**변경 내용**:
```typescript
// 상단 import 추가
import { registerNotificationHandlers } from "../handlers/NotificationEventHandler";

// registerAllEventHandlers() 본문
// Phase 1.7: NotificationService 핸들러
registerNotificationHandlers();   // 주석 해제 (기존: // registerNotificationHandlers();)
```

**설계 결정**: `registerAllEventHandlers()` **자체의 startup 호출(app 진입점)은 Phase 1.9 위임**. 1.7은 등록 함수를 호출 그래프에 **연결만** 하고(import + 본문 호출 해제), 실제 실행 활성화는 1.9 startup wiring에서 이뤄진다.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

| 컬렉션 | 문서 구조 | 용도 |
|--------|----------|------|
| `users/{userId}/notifications/settings` | (변경 없음) `AlarmSubscription` | **읽기만** — `getAllActiveSubscribers()`가 collectionGroup `notifications` + `enabled == true`로 조회 |

> Phase 1.7은 Firestore에 쓰지 않는다. 스키마 변경 없음.

### 3.2 이벤트 페이로드

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| `RECRUIT_NEW` (구독) | `RecruitNewEvent { timestamp, source?, addedJobs, updatedJobs, deletedIds }` | (Phase 1.3 발행분 수신) |
| `NOTIFICATION_SEND` (발행) | `NotificationSendEvent { timestamp, source, userId, jobs: Job[], settings: AlarmSubscription }` | 구독자별 매칭 잡 ≥ 1건일 때 |

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | 모드/지역 필터 순수 함수 | `common/utils/recruitFilter.ts` (신규) | §2.1 |
| 2 | 오케스트레이션 서비스 | `services/notificationService.ts` (신규) | §2.2 |
| 3 | 이벤트 핸들러 | `events/bus/handlers/NotificationEventHandler.ts` (신규) | §2.3 |
| 4 | 핸들러 등록 활성화 | `events/bus/utils/registerEventHandlers.ts` (수정) | §2.4 |

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger 사용 (`globalLogger`, console.log 금지)
- [ ] SystemError 패턴 준수 (핸들러 try-catch — 재throw 금지)
- [ ] EventBus 타입 안전 이벤트 (`emitEvent<T>`/`onEvent<T>` 제네릭)
- [ ] JSDoc 주석 (public API: `filterByMode`/`filterByRegion`/`notifyNewRecruits`/`registerNotificationHandlers`)
- [ ] 한국어 주석 (정책·결정 사항)
- [ ] 타입 SoT 재사용 (`AlertMode`/`AlarmSubscription`/`Job`/이벤트 페이로드 — 신규 타입 정의 금지)

---

## 6. 테스트 계획

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 타입 컴파일 | `npx tsc --noEmit` | 에러 없음 |
| 기존 `RECRUIT_NEW` 발행부 무변경 | `recruitCacheService.ts` diff 확인 | 변경 없음 |
| 핸들러 등록 연결 | `registerEventHandlers.ts` 호출 그래프 확인 | `registerNotificationHandlers` import + 호출 연결 |
| 필터 — ALL 모드 | 수동 검증 | 전체 `targetJobs` 반환 |
| 필터 — SELECTED 모드 (복수 지역) | 수동 검증 | 매칭 지역 공고만 반환 |
| 필터 — 빈 지역(`regions: []`) | 수동 검증 | 0건 반환 |
| 매칭 0건 구독자 | 수동 검증 | `NOTIFICATION_SEND` 미발행 |

> **런타임 E2E 불가(알려진 갭)**: 1.7 단독으로는 1.8 DM sender·1.9 startup wiring 미완으로 실제 DM 전송을 검증할 수 없다. E2E 검증은 Phase 1.9 통합 시점으로 명시 — 1.7은 정적 검증(타입·등록 연결·필터 단위) 위주.

---

*작성일: 2026-06-09*
*참고: docs/phase-1-7/01-plan.md*

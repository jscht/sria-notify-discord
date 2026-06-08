# Phase 1.7 갭 분석: 자동 알림 시스템 (auto-notification-system)

**상태**: 🔍 검토 중
**분석일**: 2026-06-09
**설계서**: `docs/phase-1-7/02-design.md`

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1 `recruitFilter.ts` 신규 파일 | 존재 | ✅ | `common/utils/recruitFilter.ts` |
| S2 | §2.1 `filterByRegion(jobs, regions)` export | 존재, 시그니처 일치 | ✅ | recruitFilter.ts:26 |
| S3 | §2.1 `filterByMode(jobs, subscription)` export | 존재, 시그니처 일치 | ✅ | recruitFilter.ts:48 |
| S4 | §2.2 `notificationService.ts` 신규 파일 | 존재 | ✅ | `services/notificationService.ts` |
| S5 | §2.2 `NotificationService` + `notifyNewRecruits` | 존재 | ✅ | notificationService.ts:17,26 |
| S6 | §2.2 `notificationService` 싱글톤 export | 존재 | ✅ | notificationService.ts:47 |
| S7 | §2.3 `NotificationEventHandler.ts` 신규 파일 | 존재 | ✅ | `events/bus/handlers/NotificationEventHandler.ts` |
| S8 | §2.3 `registerNotificationHandlers()` export | 존재 | ✅ | NotificationEventHandler.ts:15 |
| S9 | §2.4 `registerEventHandlers.ts` import 추가 | import 존재 | ✅ | registerEventHandlers.ts:10 |
| S10 | §2.4 `registerEventHandlers.ts` 본문 호출 활성화 | 주석 해제·활성 호출 | ✅ | registerEventHandlers.ts:50 |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.2 잡셋 = addedJobs + updatedJobs 합집합 | `[...addedJobs, ...updatedJobs]` | ✅ | notificationService.ts:27 |
| F2 | §2.2 빈 잡셋 조기 반환 | `if (targetJobs.length === 0) return;` | ✅ | notificationService.ts:28 |
| F3 | §2.2 활성 구독자 조회 | `getAllActiveSubscribers()` | ✅ | notificationService.ts:30 |
| F4 | §2.1 ALL→전체 / SELECTED→지역필터 | 삼항 분기 정확 | ✅ | recruitFilter.ts:48-52 |
| F5 | §2.2 매칭 0건 구독자 미발행 | `if (matchedJobs.length === 0) continue;` | ✅ | notificationService.ts:34 |
| F6 | §2.2 매칭 ≥1건 시 구독자별 발행 | 루프 내 emitEvent | ✅ | notificationService.ts:36 |
| F7 | §2.1 빈 지역 0건 반환 | `if (regions.length === 0) return [];` | ✅ | recruitFilter.ts:27 |
| F8 | §2.1 지역 매칭 = `title.includes(toKorean(region))` | 정확 + undefined 지명 필터 | ✅ | recruitFilter.ts:29-35 |
| F9 | §2.3 핸들러 try-catch, 재throw 금지 | try-catch + globalLogger.error, 재throw 없음 | ✅ | NotificationEventHandler.ts:17-24 |
| F10 | §2.2 생성자 리스너 등록 안 함(관심사 분리) | 생성자에 onEvent 없음 | ✅ | notificationService.ts:17-18 |
| F11 | §2.2 동기 루프 구독자별 발행 | for-of 동기 루프 | ✅ | notificationService.ts:32-43 |

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | §3.2 `RecruitNewEvent` flat 구조 | `payload.addedJobs`/`payload.updatedJobs` 직접 접근 (SoT: extends JobDiffResult) | ✅ | types.ts:77 |
| C2 | §3.2 `NotificationSendEvent` 5개 필드 | timestamp/source/userId/jobs/settings 모두 발행 | ✅ | types.ts:116-120 |
| C3 | §5 `emitEvent<NotificationSendEvent>` 제네릭 | 명시 | ✅ | notificationService.ts:36 |
| C4 | §2.3 `onEvent<RecruitNewEvent>` 제네릭 | 명시 | ✅ | NotificationEventHandler.ts:16 |
| C5 | §5 `AlertMode` as const 사용 | `=== AlertMode.ALL` (SoT as const 객체) | ✅ | recruitFilter.ts:49 |
| C6 | §5 `AlarmSubscription`/`Job`/`CityEn` SoT 재사용 | import만, 신규 정의 없음 | ✅ | recruitFilter.ts:8-11 |
| C7 | §3.1 `getAllActiveSubscribers(): Promise<AlarmSubscription[]>` | 시그니처 일치, await | ✅ | subscription.ts:121 |
| C8 | §3.2 `EventType.NOTIFICATION_SEND` 발행 | enum값 `"notification:send"` | ✅ | types.ts:28 |
| C9 | §3.2 `EventType.RECRUIT_NEW` 구독 | enum값 `"recruit:new"` | ✅ | types.ts:21 |
| C10 | §2.1 `filterByRegion` 시그니처 | 정확 일치 | ✅ | recruitFilter.ts:26 |
| C11 | §2.1 `toKorean` 반환 undefined 처리 | 타입가드 필터링 | ✅ | recruitFilter.ts:31 |

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 10/10 | 100% |
| Functional (×0.4) | 11/11 | 100% |
| Contract (×0.4) | 11/11 | 100% |
| **종합 매치율** | | **100%** |

### 산출 공식
```
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
           = 100 × 0.2 + 100 × 0.4 + 100 × 0.4 = 100%
```

---

## 3. 갭 목록

### 3.1 미구현 항목

| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| — | — | — | 정적 갭 없음 (설계-구현 완전 일치) | — |

### 3.2 설계 차이

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| — | (없음) | — | — |

> **알려진 런타임 갭 (설계 명시, 정적 매치율과 무관)**: `registerAllEventHandlers()` startup 호출(1.9)·실제 DM 전송(1.8)은 의도적 제외. 1.7 단독 E2E DM 미동작은 갭이 아니라 설계된 이벤트 경계. E2E는 1.9 통합 시점.

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟡 Major | 컨벤션 | recruitFilter.ts:8-9 | import 경로 분리 — `Job`은 `@/common/types/job.d`, 나머지는 `@/common/types` 배럴. `Job`도 배럴 재노출됨 | `@/common/types` 한 경로로 통합 가능(권장) |
| 2 | 🟡 Major | 정확성 | notificationService.ts:27 | `updatedJobs`(변경 공고)까지 알림 대상 — 중복 알림 체감 가능성 | **사용자 확정 사항**(addedJobs+updatedJobs). JSDoc 명시됨 — 조치 불요 |
| 3 | 🟢 Minor | 성능 | notificationService.ts:30-43 | O(N·M) 선형 필터 + 구독자마다 `toKorean()` 반복 변환 | 규모 확장 시 koreanNames 캐싱/역인덱스 (현 단계 불요) |
| 4 | 🟢 Minor | 컨벤션 | notificationService.ts:36 | EventBus 시그니처가 EventType↔페이로드 미연결(EventPayloadMap 미적용) — 코드 자체는 올바름 | EventBus 메서드 개선은 별도 사이클 후보 |
| 5 | 🟢 Minor | 컨벤션 | notificationService.ts:1 | service가 `globalLogger` 직접 미사용인데 side-effect import 존재 | 추후 로깅 대비면 유지 무방 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger(globalLogger) 사용 | ✅ | 핸들러 `globalLogger.error(msg, error, context)`, strict 통과 |
| console.log 부재 | ✅ | 4개 파일 모두 console 직접 호출 없음 |
| SystemError 패턴 | ✅(N/A) | 핸들러 try-catch + globalLogger.error로 충분(재throw 금지 목적) |
| EventBus 제네릭 타입 안전 | ✅ | `emitEvent<T>`/`onEvent<T>` 명시 |
| 타입 SoT 재사용 | ✅ | 신규 타입 중복 정의 0건 |
| 네이밍 규칙 | ✅ | 함수 camelCase / 클래스 PascalCase / 파일명 규칙 준수 |
| import 정리 | 🟡 | type/value import 혼재(이슈 #1) |
| JSDoc (public API) | ✅ | 전 export JSDoc + 정책 출처 명시(모범) |
| 레이어 의존 규칙 | ✅ | 필터 `common/utils` 배치 → services→features 금지 준수 |
| 발행부 패턴 대칭성 | ✅ | `recruitCacheService` try-catch 패턴과 대칭 |

### 4.3 요약
- 🔴 Critical: 0건
- 🟡 Major: 2건 (#1 import 일관성 / #2 변경 공고 알림 — 사용자 확정, 실질 조치 0)
- 🟢 Minor: 3건 (모두 현 단계 액션 불요)

---

## 5. 다음 단계 분기

✅ **매치율 100% (≥ 90%) AND 🔴 Critical 0건** → `/pdca report 1.7` 진행 가능

- CTO Lead 사후 평가 생략 가능 (매치율 ≥ 90% AND Critical 0 — 비용 절감 규칙)
- Major #1(import 통합)은 선택적 클린업 — report 전 즉시 반영 또는 보류 선택
- (선택) 런타임 검증은 1.7 단독 불가(1.8/1.9 미완) → 1.9 통합 시점 권장

---

*분석일: 2026-06-09*
*참고: docs/phase-1-7/02-design.md*

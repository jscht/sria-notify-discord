# Phase 1.6 갭 분석: 공고 요청 기능 개선 (recruit-request-enhancement)

**상태**: 🔍 검토 중
**분석일**: 2026-04-30
**설계서**: `docs/phase-1-6/02-design.md`

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.1 - `import type CRAWL_MODE, RecruitData` 추가 | ✅ | Y | `events/bus/types.ts:9-10` |
| 2 | §2.1 - `EventType.RECRUIT_REQUESTED` enum 항목 존재 | ✅ | Y | `events/bus/types.ts:21` |
| 3 | §2.1 - `EventType.RECRUIT_REQUEST_COMPLETED` enum 항목 추가 | ✅ | Y | `events/bus/types.ts:22` |
| 4 | §2.1 - `RecruitRequestedEvent` 재정의 (jobs 제거, mode 추가) | ✅ | Y | `events/bus/types.ts:79-83` |
| 5 | §2.1 - `RecruitRequestCompletedEvent` 신규 추가 | ✅ | Y | `events/bus/types.ts:86-93` |
| 6 | §2.1 - `EventPayloadMap`에 `RECRUIT_REQUESTED` 매핑 | ✅ | Y | `events/bus/types.ts:186` |
| 7 | §2.1 - `EventPayloadMap`에 `RECRUIT_REQUEST_COMPLETED` 매핑 | ✅ | Y | `events/bus/types.ts:187` |
| 8 | §2.3 - `onRecruitRequest`에서 `eventBus`, `EventType` import | ✅ | Y | `onRecruitRequest.ts:8-9` |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.3 - `RECRUIT_REQUESTED` 이벤트가 `getRecruitList` 호출 직전 발행 | ✅ | Y | `onRecruitRequest.ts:30-39` |
| 2 | §2.3 - `RECRUIT_REQUEST_COMPLETED` 정상 경로(redis/firestore/crawler) 발행 | ✅ | Y | `onRecruitRequest.ts:45-58` |
| 3 | §2.3 - `RECRUIT_REQUEST_COMPLETED` 빈결과(empty) 경로 발행 | ✅ | Y | `onRecruitRequest.ts:45-58` |
| 4 | §2.3 - `RECRUIT_REQUEST_COMPLETED` 에러 경로(error) 발행 | ✅ | Y | `onRecruitRequest.ts:67-78` |
| 5 | §2.3 - `jobs` 필드에 `data ?? []` 패턴 적용 | ✅ | Y | `onRecruitRequest.ts:52` |
| 6 | §3.2 - `tier` 값이 redis/firestore/crawler/empty/error 중 올바른 값으로 전달 | ✅ | Y | `recruitService.ts:44,61,76,80` |
| 7 | §2.2 - `durationMs`가 `startedAt` 기준으로 산출되어 페이로드에 포함 | ✅ | Y | `recruitService.ts:37` + `onRecruitRequest.ts:54,76` |
| 8 | §2.2 - `RecruitService` 내부에서 EventBus 미사용 (서비스 순수성) | ✅ | Y | `recruitService.ts` (eventBus import 없음) |
| 9 | §2.3 - 지역 검증 실패 시 이벤트 발행 없이 early return | ✅ | Y | `onRecruitRequest.ts:18-23` |
| 10 | §2.2 - `HttpError.TooManyRequests` throw 유지, catch에서 error 이벤트 발행 | ✅ | Y | `recruitService.ts:70` + `onRecruitRequest.ts:67-78` |

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.2 - `getRecruitList` 반환 타입이 `{ data, tier, durationMs }` 객체 | ✅ | Y | `recruitService.ts:33-36` |
| 2 | §2.2 - tier 유니온 타입에 `'redis'\|'firestore'\|'crawler'\|'empty'` 포함 | ✅ | Y | `recruitService.ts:36` |
| 3 | §2.2 - `getCityFilteredList` 호출 시 `await` 적용 (객체 리터럴 내부) | ✅ | Y | `recruitService.ts:44,61,80` |
| 4 | §2.4 - `RecruitScheduler`에서 구조분해 `{ data: recruitData }` 적용 | ✅ | Y | `RecruitScheduler.ts:39` |
| 5 | §2.4 - `test/routes.ts`에서 구조분해 `{ data: recruitList }` 적용 | ✅ | Y | `test/routes.ts:18` |
| 6 | §2.3 - `RECRUIT_REQUESTED` 발행이 try-catch로 보호됨 | ✅ | Y | `onRecruitRequest.ts:29-39` |
| 7 | §2.3 - `RECRUIT_REQUEST_COMPLETED`(정상) 발행이 try-catch로 보호됨 | ✅ | Y | `onRecruitRequest.ts:45-58` |
| 8 | §2.3 - `RECRUIT_REQUEST_COMPLETED`(에러) 발행이 try-catch로 보호됨 | ✅ | Y | `onRecruitRequest.ts:67-78` |
| 9 | §2.1 - `RecruitRequestedEvent`에 `jobs` 필드가 없음 (재정의 적용) | ✅ | Y | `events/bus/types.ts:79-83` |
| 10 | §2.1 - `RecruitRequestCompletedEvent`에 `jobs`, `tier`, `durationMs` 모두 존재 | ✅ | Y | `events/bus/types.ts:86-93` |
| 11 | §2.1 - `RecruitRequestCompletedEvent.tier`에 `'error'` 포함 (에러 경로용) | ✅ | Y | `events/bus/types.ts:91` |
| 12 | §5 - `emitEvent<T>()` 제네릭으로 타입 안전 발행 | ✅ | Y | `onRecruitRequest.ts:30,46,68` |

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 8/8 | 100.0% |
| Functional (×0.4) | 10/10 | 100.0% |
| Contract (×0.4) | 12/12 | 100.0% |
| **종합 매치율** | | **100.0%** |

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
= 100.0 × 0.2 + 100.0 × 0.4 + 100.0 × 0.4 = 100.0%
```

---

## 3. 갭 목록

### 3.1 미구현 항목

없음 — 모든 설계 항목이 구현되었습니다.

### 3.2 설계 차이 (허용)

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | §2.3 에러 경로 이벤트 발행은 catch 내부에서만 발행 | 정상 경로에서 completed emit 후 editReply 도중 예외 시 outer catch에서 error 이벤트 추가 발행 가능 | 허용 (설계와 동일 구조. editReply 실패는 드물고 분석 시 2회 이벤트 가능성 인지 필요) |
| 2 | §2.2 서비스 반환 타입 tier에 `'error'` 미포함 | `RecruitService` 반환은 `'error'` 없음. 핸들러 catch에서 직접 부여 | 허용 (계약상 명확. 이벤트 타입에는 `'error'` 포함되어 일관성 유지) |
| 3 | §2.1 절대경로 alias `@/events/bus` 사용 가정 | `onRecruitRequest.ts`에서 EventBus는 `@/` alias, 나머지 import는 상대경로 혼용 | 허용 (Phase 1.6 범위는 이벤트 추가. 경로 통일은 별도 리팩토링 영역) |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟡 | DRY | `onRecruitRequest.ts:29-78` | 이벤트 발행 try-catch 블록 3회 반복, 동일 컨텍스트(userId/region/mode/source) 매번 수동 구성 | `safeEmit<T>(eventType, payload)` 공통 헬퍼 추출 (Phase 1.7 이후) |
| 2 | 🟡 | TypeScript | `onRecruitRequest.ts:34,50,72` | `region as CityEn` 캐스팅 3회 반복. 한국어 지역명이 CityEn(영문) 타입으로 강제 캐스팅, 의미 불일치 | 이벤트 타입 region을 `string` 또는 발행 전 `toEnglish()` 변환 검토 |
| 3 | 🟡 | TypeScript | `onRecruitRequest.ts:85` | `validateRegion(cityName: any)` — any 사용 | `unknown`으로 변경 후 타입가드 적용 |
| 4 | 🟡 | 컨벤션 | `onRecruitRequest.ts:78` | `} catch (e) { /* swallow */ }` — 빈 catch 블록, 에러 발행 실패가 silent | `globalLogger.warn("이벤트 발행 실패(에러 경로)")` 최소 로깅 추가 |
| 5 | 🟡 | 성능 | `onRecruitRequest.ts:68,76` | 에러 경로에서 `Date.now()` 2회 호출 (timestamp + durationMs) | `const completedAt = Date.now()`로 1회 저장 후 재사용 |
| 6 | 🟡 | TypeScript | `events/bus/types.ts:153` | `SystemErrorEvent.context?: Record<string, any>` — any 사용 (기존 코드) | `Record<string, unknown>` 변경 |
| 7 | 🟡 | TypeScript | `RecruitScheduler.ts:59-67` | `throw { success: false, ... }` — plain object throw, Error 인스턴스 아님, stack trace 손실 (기존 코드) | `SystemError` 팩토리 또는 `Object.assign(new Error(...), {...})` 패턴 |
| 8 | 🟡 | 컨벤션 | `recruitService.ts:63-65` | Firestore catch에서 에러 정보 미로깅 (Redis catch와 비대칭) | `if (err instanceof Error) globalLogger.error(...)` 추가 |
| 9 | 🟡 | 컨벤션 | `onRecruitRequest.ts:3-7` | 절대/상대경로 import 혼용 (`../../../services` vs `@/events/bus`) | `@/` 절대경로로 통일 |
| 10 | 🟡 | TypeScript | `recruitService.ts:42,74,106,108` | `as CityEn` / `as CityKo` 강제 캐스팅 다수 (기존 코드) | `convertCityByMode` 오버로드 시그니처 검토 |
| 11 | 🟡 | DRY | `events/bus/types.ts:91` + `recruitService.ts:36` | tier 유니온 리터럴 중복 정의 (양쪽 sync 어긋날 위험) | `export type RecruitTier = ...` 공유 타입 alias 도입 |
| 12 | 🟢 | 보안 | `onRecruitRequest.ts:15-23` | 사용자 입력 `cityName`을 백틱 안에 직접 출력, markdown injection 가능성 낮으나 입력값 sanitize 미흡 | 길이 제한 또는 특수문자 escape 검토 |
| 13 | 🟢 | DRY | `recruitService.ts:44,61,80` | `getCityFilteredList(mode, convertedCity, ...) + return 객체` 패턴 3회 반복 (tier만 다름) | `buildResult(data, tier, startedAt)` 헬퍼 추출 (선택사항) |
| 14 | 🟢 | 성능 | `recruitService.ts:58-60` | `setRecruitList().catch()` fire-and-forget (의도된 패턴이나 Functions 종료 시 유실 가능) | 의도 주석 명시 |
| 15 | 🟢 | 컨벤션 | `test/routes.ts:36,89,94-96` | `Record<string, any>`, await 누락, 빈 Discord 핸들러 (기존 코드) | 테스트 라우트 점진적 정리 |
| 16 | 🟢 | DRY | `events/bus/types.ts:153` | `SystemErrorEvent.context` any 타입 (기존) | `unknown`으로 전환 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger 사용 | ✅ | 모든 파일 `globalLogger.*` 사용, console.log 없음 |
| SystemError 패턴 | ❌ | `RecruitScheduler.ts:59-67` plain object throw (기존 코드) |
| 네이밍 규칙 | ✅ | EventType SCREAMING_SNAKE, 클래스 PascalCase, 함수/변수 camelCase 준수 |
| import 정리 | ❌ | `onRecruitRequest.ts` 절대/상대경로 혼용 |

### 4.3 요약

- 🔴 Critical: **0건**
- 🟡 Warning: **11건** (이 중 7건은 기존 코드 범위)
- 🟢 Info: **5건**

> Phase 1.6 신규 추가 코드에서 Critical 이슈 없음. 주요 Warning은 DRY(safeEmit 패턴)와 TypeScript(region 캐스팅)이며, 기능 동작에 영향 없는 개선 사항.

---

## 5. 다음 단계 분기

✅ **매치율 100% ≥ 90%** → `/pdca report 1.6` 진행 가능

---

*분석일: 2026-04-30*
*참고: docs/phase-1-6/02-design.md*

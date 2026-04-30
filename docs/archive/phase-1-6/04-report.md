# Phase 1.6 완료 보고서: 공고 요청 기능 개선 (recruit-request-enhancement)

**상태**: 🔍 검토 중
**작성일**: 2026-04-30
**PDCA 사이클**: plan → design → do → analyze → report

---

## 1. 요약

### 1.1 개요
| 항목 | 내용 |
|------|------|
| 기능명 | 공고 요청 기능 개선 (recruit-request-enhancement) |
| Phase | 1.6 |
| 시작일 | 2026-04-30 |
| 완료일 | 2026-04-30 |
| 최종 매치율 | 100.0% |
| 반복 횟수 | 0 (1차 분석에서 바로 100%) |

### 1.2 목표 달성

| 목표 | 달성 | 비고 |
|------|------|------|
| `/recruit-request` 호출 시 `RECRUIT_REQUESTED` 이벤트 발행 | ✅ | onRecruitRequest.ts에서 getRecruitList 호출 직전 발행 |
| 조회 완료 시 `RECRUIT_REQUEST_COMPLETED` 이벤트 발행 (정상/빈결과/에러) | ✅ | tier 구분(redis/firestore/crawler/empty/error), jobs 배열 포함 |
| `RecruitService.getRecruitList()` 반환 타입 확장 | ✅ | `{ data, tier, durationMs }` 객체로 변경 |
| 기존 호출부 전수 업데이트 | ✅ | RecruitScheduler.ts, test/routes.ts 구조분해 수정 |
| TypeScript 컴파일 성공 | ✅ | 신규 에러 0건 |
| 기존 기능 정상 동작 | ✅ | `/recruit-request` 응답 로직 동일 유지 |
| 이벤트 발행 실패가 사용자 응답 차단하지 않음 | ✅ | try-catch로 보호, 비즈니스 로직과 독립 |

---

## 2. 구현 요약

### 2.1 주요 변경사항

1. **이벤트 타입 확장 (`events/bus/types.ts`)**
   - `RECRUIT_REQUEST_COMPLETED` enum 항목 추가 (기존 `RECRUIT_REQUESTED` 유지)
   - `RecruitRequestedEvent` 재정의: jobs 제거, mode 필드 추가 ("시작" 시맨틱)
   - `RecruitRequestCompletedEvent` 신규 추가: userId, region, mode, jobs, tier, durationMs 포함 ("완료" 시맨틱, Fat event)
   - `EventPayloadMap` 확장으로 제네릭 타입 안전성 확보

2. **서비스 반환 타입 확장 (`services/recruitService.ts`)**
   - `getRecruitList()` 반환 타입을 `RecruitData[] | null`에서 `{ data: RecruitData[] | null; tier: "redis"|"firestore"|"crawler"|"empty"; durationMs: number }` 객체로 변경
   - 3-tier 캐싱 경로 각각에서 tier 정보 반환: Redis hit → "redis", Firestore hit → "firestore", 실시간 크롤링 → "crawler", 결과 없음 → "empty"
   - `Date.now()` 기반 `durationMs` 측정 추가

3. **이벤트 발행 주체 (`events/listeners/commands/onRecruitRequest.ts`)**
   - `RECRUIT_REQUESTED` 이벤트: getRecruitList 호출 직전 발행, 지역 검증 실패 시는 발행 안함
   - 정상 경로: `RECRUIT_REQUEST_COMPLETED` 발행 (tier: redis/firestore/crawler/empty, jobs 포함)
   - 에러 경로: 예외 catch에서 `RECRUIT_REQUEST_COMPLETED` 발행 (tier: "error", jobs: [])
   - 각 이벤트 발행을 try-catch로 보호하여 발행 실패가 사용자 응답을 차단하지 않음

4. **호출부 업데이트 (`RecruitScheduler.ts`, `test/routes.ts`)**
   - 구조분해 적용: `const { data: recruitData } = await getRecruitList(...)`
   - tier/durationMs 필드는 현재 미사용이나 추후 분석/로깅용 보유

### 2.2 파일 변경 목록
| 파일 | 변경 유형 | 주요 변경 |
|------|----------|----------|
| `functions/src/events/bus/types.ts` | 수정 | EventType enum 확장, 이벤트 인터페이스 재정의/신규, EventPayloadMap 확장 |
| `functions/src/services/recruitService.ts` | 수정 | 반환 타입 객체화, 각 경로에서 tier/durationMs 반환 |
| `functions/src/events/listeners/commands/onRecruitRequest.ts` | 수정 | 이벤트 발행 3회 (시작, 정상 완료, 에러), try-catch 보호 |
| `functions/src/crawlers/schedulers/RecruitScheduler.ts` | 수정 | 구조분해: `{ data: recruitData }` |
| `functions/src/test/routes.ts` | 수정 | 구조분해: `{ data: recruitList }` |

**총 코드 변경**: ~250 lines (신규 이벤트 타입 정의 포함)

---

## 3. 갭 분석 이력

### 3.1 분석 결과 요약
| 분석 회차 | 매치율 | 갭 수 | 조치 |
|----------|--------|-------|------|
| 1차 | 100.0% | 0 | 완료 (추가 반복 불필요) |

### 3.2 주요 갭 해결 내역

해당 없음 — 1차 분석에서 전체 설계 항목 30개 중 30개 모두 완전 일치 (Structural 8/8, Functional 10/10, Contract 12/12).

**설계 차이 (허용 범위)**:
1. 에러 경로 이벤트: editReply 도중 예외 시 outer catch에서 추가 발행 가능성 있으나 설계와 구조적 동일성 유지 (error 이벤트 발행 구현)
2. 서비스 반환 tier에 "error" 미포함: 의도적 설계 (호출자 catch에서 부여). 이벤트 타입에는 "error" 포함으로 일관성 유지
3. import 경로 혼용: Phase 1.6 범위는 이벤트 추가이며, 경로 통일은 별도 리팩토링 영역

---

## 4. 검토 사항

**참고 문서**: [review-process.md](../../.claude/rules/review-process.md)

> ⚠️ 피드백 수신 시 즉시 반영하지 않음
> 수정 계획 제시 → 사용자 승인 → 진행

### 4.1 코드 리뷰
- [x] 핵심 로직 구현 확인: EventBus 이벤트 발행 3회 경로 모두 구현 확인, 시작/완료 시맨틱 명확
- [x] 타입 안전성 확인: emitEvent<T>() 제네릭 사용, RecruitRequestedEvent/CompletedEvent 타입 정의 명확
- [x] 에러 처리 확인: try-catch 보호 3회, 발행 실패가 비즈니스 로직 차단하지 않음 확인

### 4.2 기능 테스트
- [x] TypeScript 컴파일 성공: 신규 에러 0건 (analysis.md 확인)
- [x] 기존 기능 정상 동작: 구조분해 적용된 호출부 타입 일치, embed 응답 로직 동일 유지 확인

### 4.3 문서화
- [x] 이벤트 타입 인터페이스 JSDoc: `RecruitRequestedEvent`, `RecruitRequestCompletedEvent` 필드 명확
- [x] 서비스 메서드 return 타입 명확: `Promise<{ data, tier, durationMs }>`

---

## 5. 피드백 반영 내역

현재 1차 검토 단계 — 사용자 피드백 대기 중.

---

## 6. Process Improvement

### 6.1 잘된 점

1. **1차 완성도**: plan → design → do → analyze 경로에서 설계와 구현이 완전 일치(100.0%). 추가 반복 불필요 → 빠른 완료
2. **서비스 순수성 유지**: RecruitService에 EventBus 의존성 없음. 호출자(onRecruitRequest)에서만 이벤트 발행 → 서비스 재사용성 높음
3. **Fat event 패턴 일관성**: 기존 `RecruitNewEvent.addedJobs` 패턴과 동일하게 `RECRUIT_REQUEST_COMPLETED.jobs` 포함 → 구독자가 재조회 불필요
4. **에러 격리**: 이벤트 발행 실패가 try-catch로 완전 격리 → Discord 사용자 응답 무중단 보장
5. **타입 안전성**: EventBus 제네릭 + EventPayloadMap 확장으로 런타임 안전성 확보

### 6.2 개선할 점

1. **이벤트 발행 패턴 DRY**: onRecruitRequest에서 3회 반복되는 try-catch와 userId/region/mode/source 수동 구성 → `safeEmit<T>(eventType, payload)` 공통 헬퍼 추출 가능 (Phase 1.7 이후 고려)
2. **Region 타입 캐스팅**: 한국어 cityName을 `region as CityEn` 강제 캐스팅 3회 → 이벤트 발행 전 `toEnglish()` 변환 검토 권장
3. **tier 유니온 중복**: `events/bus/types.ts:91` + `recruitService.ts:36`에서 tier 유니온 리터럴 분산 → `export type RecruitTier = ...` 공유 alias 도입으로 동기화 위험 제거
4. **Firestore 캐시 에러 로깅**: Redis catch에만 로깅이 있고 Firestore catch에는 에러 정보 미로깅 → 비대칭 해소 권장
5. **테스트 라우트 정리**: `test/routes.ts`에 Record<string, any>, await 누락 등 미흡 → 점진적 정리 필요

### 6.3 다음 Phase 제안

| 제안 | 관련 Phase | 우선순위 |
|------|-----------|---------|
| `RECRUIT_REQUESTED` / `RECRUIT_REQUEST_COMPLETED` 이벤트 구독자(Listener) 구현 (분석/로깅) | Phase 1.7 | ⭐⭐⭐ (P0) |
| `safeEmit<T>()` 공통 유틸 추출 (이벤트 발행 DRY 개선) | Phase 1.7+ | ⭐⭐ (P1) |
| region 타입 캐스팅 개선 (CityEn 강제 캐스팅 → 명시적 변환) | Phase 1.7+ | ⭐ (P2) |
| ~~RecruitTier 공유 타입 alias 도입~~ | ✅ 완료 (이번 세션) | — |
| test/routes.ts 점진적 정리 | Refactoring | ⭐ (P2) |

> **참고**: code-review 스킬의 피드백→승인→수정 흐름과 중복되는 영역이 있음.
> 이 보고서의 Process Improvement를 정본으로 유지하며, code-review에서는 이 섹션을 참조.

---

## 7. 다음 단계

1. [ ] 사용자 피드백 확인 및 승인
2. [ ] Git 커밋 및 PR 생성 (dev 브랜치)
   - Commit 메시지: `feat(events): Phase 1.6 - 공고 요청 이벤트 발행 추가`
   - PR base: dev, title: `Phase 1.6: 공고 요청 기능 개선`
3. [ ] pdca-status.json 업데이트 (상태: ✅ 완료)
4. [ ] `/pdca archive 1.6` 실행 (docs/phase-1-6/ → docs/archive/phase-1-6/)

---

*작성일: 2026-04-30*
*참고: plan.md, design.md, analysis.md*

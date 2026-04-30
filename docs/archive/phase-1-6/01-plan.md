# Phase 1.6: 공고 요청 기능 개선 (recruit-request-enhancement)

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐ (P1)
**의존성**: Phase 1.1 (EventBus 인프라) 완료

---

## 개요

### 배경
`/recruit-request` 슬래시 커맨드는 사용자가 공고를 직접 조회하는 핵심 진입점이다. 그러나 구현 당시 EventBus가 존재하지 않아 이벤트 발행이 없었고, 크롤링·자동알림 흐름과 달리 **사용자 요청 기반 조회에는 관찰성(observability)이 전혀 없는 상태**였다. 또한 `RecruitService.getRecruitList()`의 반환 타입이 `RecruitData[] | null`로만 정의되어, 어느 tier에서 응답했는지(Redis/Firestore/Crawler) 호출자가 알 수 없었다.

### 목표
- 사용자 요청 기반 조회 흐름에 EventBus 이벤트 발행 추가 — 향후 분석·알림·AI 히스토리 연계를 위한 hook 확보
- `RecruitService.getRecruitList()` 반환 타입 확장으로 tier 및 소요 시간 정보 노출

### 범위

| 포함 | 제외 |
|------|------|
| `RECRUIT_REQUESTED` 이벤트 발행 (시작) | 이벤트 구독자(Listener) 구현 |
| `RECRUIT_REQUEST_COMPLETED` 이벤트 발행 (완료, Fat event) | `safeEmit` 공통 유틸 추출 |
| `RecruitService.getRecruitList()` 반환 타입 확장 | `onRecruitRequest` 에러 메시지 개선 |
| `onRecruitRequest` 핸들러를 이벤트 발행 주체로 | 스켈레톤 파일 정리 |

---

## 요구사항

### 기능 요구사항
1. `/recruit-request` 호출 시 `RECRUIT_REQUESTED` 이벤트 발행 (시작 시점)
2. 조회 완료(정상/빈 결과/에러 모두) 시 `RECRUIT_REQUEST_COMPLETED` 이벤트 발행
   - `jobs: RecruitData[]` 조회 결과 포함 (Fat event 패턴)
   - `tier`: 응답 출처 (`"redis" | "firestore" | "crawler" | "empty" | "error"`)
   - `durationMs`: 소요 시간
3. 이벤트 발행 실패가 사용자 응답(Discord reply)을 막지 않아야 함

### 비기능 요구사항
- **성능**: 이벤트 발행은 동기 emit이므로 추가 레이턴시 없음 (Node EventEmitter)
- **호환성**: 기존 `onRecruitRequest` 응답 로직(editReply, embed) 동일 유지
- **에러 처리**: 이벤트 발행은 try-catch로 보호, 비즈니스 로직과 독립

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식: 서비스 순수성 + 호출자 발행

`RecruitService.getRecruitList()`는 3-tier 캐싱 로직에 `userId`를 전혀 사용하지 않는다. userId는 presentation(Discord) 계층의 메타데이터이므로, 서비스 시그니처에 추가하는 대신 **반환 타입을 확장**하여 tier/durationMs를 함께 반환하고, 호출자(`onRecruitRequest`)가 이를 조합해 이벤트를 발행한다.

**Fat event 채택**: `RECRUIT_REQUEST_COMPLETED`에 `jobs: RecruitData[]` 포함. EventBus는 in-process 동기 emit이므로 페이로드는 공유 참조 전달(추가 복사·GC 부담 없음). 구독자가 재조회 없이 결과 데이터를 즉시 사용 가능. 기존 `RecruitNewEvent.addedJobs` 패턴과 일관성 유지.

**이벤트 네이밍**: DDD 이벤트 소싱 컨벤션(과거분사로 "일어난 사실" 표현). 기존 `RECRUIT_CRAWL_STARTED/COMPLETED` 패턴과 일관.

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `events/bus/types.ts` | 수정 | `RECRUIT_REQUEST_COMPLETED` 추가, `RecruitRequestedEvent` 재정의, `RecruitRequestCompletedEvent` 신규, `EventPayloadMap` 확장 |
| `services/recruitService.ts` | 수정 | 반환 타입 `{ data, tier, durationMs }` 객체로 확장 |
| `events/listeners/commands/onRecruitRequest.ts` | 수정 | 이벤트 발행 추가 (시작/완료/에러 경로 모두) |
| `crawlers/schedulers/RecruitScheduler.ts` | 수정 | 반환 타입 변경에 따른 구조분해 적용 |
| `test/routes.ts` | 수정 | 반환 타입 변경에 따른 구조분해 적용 |

### 의존성 분석
- **의존**: Phase 1.1 EventBus 인프라 (완료), `EventBus.emitEvent<T>()` 싱글톤
- **영향**: Phase 1.7 (자동 알림 시스템) — `RECRUIT_NEW` 이벤트 구독자가 될 예정이며, Phase 1.6의 이벤트도 향후 구독 후보

---

## 성공 기준

- [x] `RECRUIT_REQUESTED` 이벤트 발행 (시작)
- [x] `RECRUIT_REQUEST_COMPLETED` 이벤트 발행 (완료, jobs 포함)
- [x] 에러 경로에서도 `RECRUIT_REQUEST_COMPLETED` 발행 (`tier: "error"`)
- [x] `RecruitService.getRecruitList()` 반환 타입 `{ data, tier, durationMs }` 객체
- [x] 기존 호출부 전수 업데이트 (RecruitScheduler, test/routes.ts)
- [x] TypeScript 컴파일 성공 (신규 에러 0개)
- [x] 기존 기능 정상 동작 확인 (`/recruit-request` 응답 로직 동일)

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| `getRecruitList` 호출부 누락 | 중 | grep으로 전수 검색 후 모두 수정 |
| Fat event 페이로드 크기 | 낮 | in-process emit → 공유 참조 전달, 복사 없음 |
| `RecruitRequestedEvent` 기존 구독자 변경 영향 | 낮 | 구독자 0개 확인 후 재정의 진행 |

---

*작성일: 2026-04-30*
*시드: .claude/phases/phase-1-core.md*

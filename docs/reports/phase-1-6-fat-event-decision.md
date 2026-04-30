# Phase 1.6 — 설계 결정 기록 (ADR): RecruitRequestCompletedEvent의 jobs 페이로드 포함 여부

- **날짜**: 2026-04-24
- **Phase**: 1.6 (recruit-request-enhancement)
- **상태**: 확정 (Fat event 채택)
- **관련 파일**:
  - `functions/src/events/bus/types.ts`
  - `functions/src/services/recruitService.ts`
  - `functions/src/events/listeners/commands/onRecruitRequest.ts`

## 배경

`/recruit-request` 플로우에 EventBus 이벤트 발행을 추가하면서, "완료" 시점의 이벤트 페이로드에 조회 결과(`jobs: RecruitData[]`)를 포함할지(Fat event) / 제외할지(Thin event) 결정이 필요했다.

초기 계획에서는 `jobs`를 제거한 Thin event 방향으로 작성했으나, 사용자 지적("캐시 없을 때 구독자가 또 조회 요청?")으로 재검토했다.

## 고려한 대안

### Option A — Fat event (채택)

- 이벤트에 `jobs: RecruitData[]` 포함
- 구독자는 이벤트만 받으면 됨, 추가 조회 불필요

### Option B — Thin event + 구독자 재조회

- 이벤트는 상태 변화만 알림 (`userId`, `tier`, `durationMs`)
- 구독자는 필요 시 서비스를 재호출하여 데이터 확보

### Option C — Thin event + 핸들러 내부 재사용

- 서비스 반환값을 핸들러가 보관하고 응답에 사용
- 구독자는 재조회 필요

## 비용 비교 (in-process EventBus 기준)

| 관점 | Option A (Fat) | Option B (Thin + 재조회) | Option C (Thin + 핸들러 재사용) |
|------|----------------|---------------------------|---------------------------------|
| 이벤트 페이로드 크기 | 배열 참조 1개 추가 | 메타만 | 메타만 |
| 메모리 | 참조 공유(동일 객체) | 참조 공유 | 참조 공유 |
| 구독자가 데이터 필요 시 | 즉시 사용 | **Redis/Firestore 재조회 발생** | Redis/Firestore 재조회 |
| 핸들러 응답 | 기존과 동일 | 기존과 동일 | 기존과 동일 |
| 네트워크 round-trip | 0 | 구독자 수 × 1회 이상 | 구독자 수 × 1회 이상 |

**결론**: Node EventEmitter는 in-process/synchronous이므로 `jobs` 배열은 참조만 전달되어 메모리 부담이 거의 없고, 반대로 Thin event는 구독자가 데이터를 필요로 할 때 외부 저장소 재조회를 유발하여 비용이 더 크다.

## 기존 코드베이스와의 일관성

`RecruitNewEvent`가 이미 동일한 Fat event 패턴을 사용 중:

```ts
// functions/src/events/bus/types.ts:73
export interface RecruitNewEvent extends BaseEvent, JobDiffResult {
  mode: CRAWL_MODE;
  region: CityEn;
  // JobDiffResult.addedJobs: RecruitData[]  ← 페이로드에 데이터 포함
}
```

새 이벤트만 Thin으로 가면 컨벤션이 갈리고, 구독자가 이벤트별로 다른 접근 방식을 외워야 한다.

## 초기에 Thin event를 제안한 이유 (자기반성)

1. **분산 시스템 패턴을 맥락 없이 적용**: CQRS/이벤트 소싱 일반 가이드라인("이벤트는 상태 변화 알림, 데이터는 재조회")을 in-process EventBus에 기계적으로 이식.
2. **기존 선례 누락**: `RecruitNewEvent.addedJobs`가 이미 Fat event라는 점을 사전 탐색에서 놓침.
3. **비용 분석 누락**: 대안별 네트워크/메모리 비용을 비교하지 않고 "일반론적으로 좋아 보이는" 방향을 먼저 제안.

사용자 지적("캐시 없을 때 구독자가 또 요청해야 하냐?")이 없었다면 불필요한 재조회 비용을 가진 설계로 진행될 뻔했다.

## 최종 결정

**Fat event 채택.** 이유:

- in-process EventBus에서 페이로드 추가 비용은 사실상 0 (참조 전달)
- Thin event는 구독자 재조회로 외부 저장소 부하 유발
- 기존 `RecruitNewEvent` 패턴과 일관성 유지
- 구독자 구현 난이도 감소 (재조회 보일러플레이트 불필요)

## 영향 범위

- `RecruitRequestCompletedEvent` 페이로드에 `jobs: RecruitData[]` 포함
- 빈 응답/에러 경로에서도 `jobs: []`로 명시 (undefined 아님)
- 추후 분산 환경(메시지 브로커 도입 등)으로 변경될 경우 이 결정을 재검토 필요

## 참고

- EventBus (in-process)와 Discord HTTP 응답은 독립 관심사 — Thin/Fat 결정이 클라이언트 응답 방식과 무관
- 향후 Phase 4 AI 핸들러 등 호출자 증가 시에도 동일 이벤트 재사용 가능 (페이로드 구조 안정성 확보)

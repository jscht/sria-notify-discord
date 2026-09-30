# Phase 1.10 설계서: 최소 base 스키마 + 사이트별 프로바이더·규칙 엔진 (mock 재정의)

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-10/01-plan.md`

> **개정 이력**: 본 설계는 2026-09-15 **2차 재정의**로 기존 "Proxy 통합·실 CRAWL" 스코프를 **폐기**하고 mock 소스 프로바이더 구조로 전환한 것이다. 목적이 **포트폴리오**이므로 실 크롤/프록시(리스크·차단·법적 이슈)를 제거하고, 실가치인 아키텍처(3-tier 캐시·diff·EventBus·DM·스케줄러)를 mock 소스로 시연한다. 소스는 프로바이더로 추상화해 언제든 실 API로 교체 가능.

---

## 0. 핵심 결정 (design 확정 사항)

| # | 결정 | 확정 내용 |
|---|------|----------|
| 1 | **최소 공용 base** | `RecruitBase{id,title,source}`만 공용(모든 소스가 보장하는 유일한 계약). 사이트별 스키마는 `SriaRecruit`/`TempRecruit`(base 확장), 파이프라인 작업 타입은 합집합 `Recruit = SriaRecruit \| TempRecruit`. 신규 사이트 = union에 arm 추가. |
| 2 | **사이트 2곳(임의 추가 금지)** | `sria` = 일반 사이트(**스냅샷 반영** — 규칙 없이 값 pool 스냅샷 반환, 변화는 diff에 위임) / `temp` = **커스텀 규칙 엔진**(이름 임시, 사용자가 후에 변경). |
| 3 | **소스별 스케줄 + 소스별 diff** | 사이트마다 `onSchedule(<config>.schedule)` export 1개. diff 삭제 판정을 `id` 접두사 `"{source}:"`로 파티션 → 한 사이트 sync가 타 사이트 공고를 오삭제하지 않음. 락 `lock:recruit:sync:{source}`. |
| 4 | **temp spec 시스템** | temp 인터페이스는 **비움**(동적). 생성기 입력 = ① `tempTitles: string[]`(제목 후보=필수) + ② `tempFields: TempField[]`(추가 속성 규칙, 초기 빈). 각 속성 = 포함 규칙(무조건/확률) + 값 규칙(고정/풀 랜덤). 사용자는 **제목만 추가**하면 나머지는 생성기가 채움. |
| 5 | **temp 규칙 모델(하이브리드)** | 생성 40%→1 / 10%→2 / 2%→3 / 48%→0. 수정 = 진행도 확정 변경 + 30% 확률 내용 수정. 삭제 = 모집기간 종료 확정 삭제 + 10% 확률 영구 삭제. |
| 6 | **stateless 결정적 시뮬레이션** | 시각 `now`의 공고 세계 = `now`의 순수 함수. serverless(상태 비저장)에서도 diff 엔진이 직전 저장분과 비교해 규칙대로 added/updated/deleted 발화. 시드 PRNG(FNV-1a + murmur3 fmix32), 경계 `t=floor(now/unitMs)`. |
| 7 | **명칭 통일** | 크롤/프록시 제거에 맞춰 `crawl`/`proxy` 명칭을 실제 도메인으로 통일: 이벤트 `RECRUIT_SYNC_*`, 에러 taxonomy `ErrorCategory.SOURCE`/`sourceFailed`/`SourceStrategy`, 로거 `sourceLogger`, tier `"source"`. |

> ⚠️ 데이터 파일은 JSON이 아니라 `.ts`(`sriaPostings.ts`·`tempTitles.ts`·`tempFields.ts`) — tsc가 `.json`을 `lib/`로 복사하지 않는 빌드 gotcha 회피(별도 복사 단계 불필요).

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Common Types (`common/types/recruit.d.ts`) | **재작성** `RecruitBase`/`SriaRecruit`/`TempRecruit`/`Recruit`/`RecruitSource`. 구 `RecruitData`·`ProviderRecruit`·`Href` **삭제**. `index.ts` export 갱신. |
| Providers (`providers/recruit/**`) | **신규 계층**. `RecruitProvider` 인터페이스 + 레지스트리(`getProvider`/`getAllProviders`) / `sria/`(스냅샷 생성기) / `temp/`(규칙 엔진 + spec + README). 구 `mock/`·`api/` **삭제**. |
| Services (`services/`) | **신규** `recruitSourceService.ts`(구 CrawlService 대체 — `fetchAll`/`fetchBySource`) / `recruitCacheService.setRecruitList(list, source?)` **소스별 diff** / `recruitService.syncRecruits(source)` 소스별 sync + 락. |
| EventBus (`events/bus/`) | `types.ts` `RECRUIT_SYNC_*`(구 `RECRUIT_CRAWL_*`)·`RecruitTier "source"` / `BaseScheduler` sync 이벤트 발행. |
| Schedulers (`schedulers/`) | `RecruitScheduler(source)` 소스별 인스턴스 / `SchedulerManager.runRecruitOnce(source)` / `initializeSchedulers` `RECRUIT_SOURCES` 순회. |
| App (`app/scheduler.ts`) | 사이트별 export `recruitSchedule_sria`/`recruitSchedule_temp` = `onSchedule(<config>.schedule)`. |
| Providers (`providers/discord/builder/embeds/`) | `jobLink.recruitField(r,key)` 방어적 읽기 + `formatJobTitleLink(title,url)` / 두 임베드 `Recruit` union 대응. |
| Store (`providers/firebase/store/recruit.ts`, `redis/store/requestLimitStore.ts`) | 반환 타입 `Recruit[]` / 요청제한 스토어(구 CrawlCacheStore) 명칭 통일. |

### 1.2 컴포넌트 다이어그램
```
onSchedule("every 4 hours")  ─▶ SchedulerManager.runRecruitOnce("sria")
onSchedule("every 30 minutes") ─▶ SchedulerManager.runRecruitOnce("temp")
                                        │
                          RecruitScheduler(source).performWork
                                        │  [BaseScheduler runOnce: RECRUIT_SYNC_STARTED/COMPLETED/FAILED]
                                        ▼
                    recruitService.syncRecruits(source)  ──[Redis 락: lock:recruit:sync:{source}]
                                        │
                    recruitSourceService.fetchBySource(source)
                                        │
                         getProvider(source).fetch()  ─▶ Recruit[]
                          ├─ SriaMockProvider  → generateSriaRecruits()      (스냅샷)
                          └─ TempMockProvider  → generateTempRecruits(now)   (규칙 엔진)
                                        │
                    recruitCacheService.setRecruitList(list, source)
                                        │  sha256 diff — currentHashes를 id 접두사 "{source}:"로 파티션
                                        ▼
                          added/updated/deletedIds  ─▶ RECRUIT_CHANGED
                                        ▼
                          NOTIFICATION_SEND ─▶ dmSender(REST) ─▶ 구독자 DM

[읽기 경로] getRecruitList(3-tier: redis→firestore→source→empty)
             tier "source" = recruitSourceService.fetchAll()(전 소스 병합·dedupeById)
```

---

## 2. 상세 설계

### 2.1 타입 계약 — `common/types/recruit.d.ts`

```typescript
export type Dday = `D-${number}` | "오늘마감" | "";
export type RecruitmentStatus = "접수중" | "발표중" | "종료";
export type RecruitSource = "sria" | "temp";

export interface RecruitBase { id: string; title: string; source: RecruitSource; }
export interface SriaRecruit extends RecruitBase {
  source: "sria"; url: string; dDay: Dday; dayTxt: string; recruitmentStatus: RecruitmentStatus;
}
export interface TempRecruit extends RecruitBase { source: "temp"; [key: string]: unknown; }
export type Recruit = SriaRecruit | TempRecruit;
```
- **보장 공통 = `RecruitBase`(id/title/source)뿐**. temp는 동적 스키마라 표시 필드가 없을 수 있음 → 다운스트림은 방어적 읽기(§2.7).
- `id = "{source}:{localId}"` = diff 식별자 겸 **소스 파티션 키**.

### 2.2 프로바이더 계층 — `providers/recruit/`

```
providers/recruit/
  RecruitProvider.ts   // interface { readonly source: RecruitSource; fetch(): Promise<Recruit[]> }
  index.ts             // 레지스트리(lazy) + getProvider(source)/getAllProviders()/createDefaultRecruitProviders()
  sria/  href.ts · sriaPostings.ts · sriaMockConfig.ts · sriaMockGenerator.ts · SriaMockProvider.ts
  temp/  tempTitles.ts · tempFields.ts · tempRule.ts · tempMockConfig.ts · TempMockProvider.ts · README.md
```
- `getProvider(source)`가 소스별 스케줄러용 단일 선택, `getAllProviders()`가 읽기 경로 병합용.
- 각 `fetch()`는 자기 사이트 타입(SriaRecruit[]/TempRecruit[])을 `Recruit[]`로 반환.

### 2.3 sria 생성기 (일반·스냅샷) — `sria/`

- `sriaPostings.ts`: `SriaSeed{title,dDay,dayTxt,recruitmentStatus}[]` — 사용자 편집 데이터.
- `sriaMockGenerator.generateSriaRecruits()`: seed → SriaRecruit 매핑, `id: \`sria:${localId}\``, `url: base ? \`${base}${href}\` : href`(base=`ENV.SRIA_URL`), `href=toHref(localId)`(`/jobs/${n}` — sria 전용, `sria/href.ts`).
- `sriaMockConfig`: `{ schedule: "every 4 hours", idBase: 100000, postings }`. **규칙 없음** — 변화 감지는 전적으로 diff에 위임(실 API 스냅샷 모사).

### 2.4 temp 규칙 엔진 — `temp/tempRule.ts` (stateless 결정적 시뮬레이션)

```typescript
export interface TempRuleConfig {
  unitMs: number; lifespanTicks: number;
  spawnProbs: { 1: number; 2: number; 3: number };
  editProb: number; deleteProb: number;
  titles: string[]; fields: TempField[];
}
export function generateTempRecruits(now: number, cfg: TempRuleConfig): TempRecruit[];
```
- **PRNG**: `hashStr`(FNV-1a) → `fmix32`(murmur3 finalizer) → `rand(...parts)=fmix32(hashStr(parts.join("|")))/2^32` ∈ [0,1). Math.random/외부 상태 미사용.
- **경계** `t=floor(now/unitMs)`. 후보 = `[max(0,t-lifespan), t]` 경계 순회(유계).
- **생성** `spawnCount(s)`: 누적확률 `r<p1→1 / <p1+p2→2 / <p1+p2+p3→3 / else 0`.
- **수정(확정)**: 진행도 `age=t-s`, `remaining=lifespan-age` → `dDay`(remaining<=1?"오늘마감":`D-${remaining-1}`)·`dayTxt`·`recruitmentStatus` 결정적 변화 → 매 경계 updated.
- **수정(확률)**: `rand(id,"edit",t)<editProb` → 내용 토글(예 `badge="급구"`).
- **삭제(확정)**: `t≥s+lifespan` 제외.
- **삭제(확률·영구)**: `firstDeathTick(id,born,lifespan,deleteProb)` = `[born+1, born+lifespan)` 중 최초 `rand(id,"del",u)<deleteProb`인 tick. `t≥death`면 영구 제외. **born+1부터** — 스폰 당일 소멸 방지(최소 1경계 노출).
- **속성 spec 적용**: 각 공고 base 부여 후 `tempFields` 순회 — `required || rand(id,"field",key)<chance`면 포함, 값은 `fixed`=고정 / `pick`=풀에서 시드 선택(`resolveValue`).

**데이터/설정**:
- `tempTitles.ts`: `string[]` — 사용자가 제목만 추가.
- `tempFields.ts`: `TempValue = {kind:"fixed",value} | {kind:"pick",pool}`; `TempField{key, required?, chance?, value}`; 초기 `[]`.
- `tempConfig`(`tempMockConfig.ts`): `schedule:"every 30 minutes", unitMs:30*60_000, lifespanTicks:48, spawnProbs:{1:0.4,2:0.1,3:0.02}, editProb:0.3, deleteProb:0.1, titles, fields`.
- `README.md`: 초보자 가이드(제목 추가→저장→배포 / 자동 채움 필드 / lifespanTicks / 고급 tempFields).

### 2.5 소스별 스케줄 — `app/scheduler.ts`

```typescript
export const recruitSchedule_sria = onSchedule(sriaConfig.schedule, async () => {
  await ready; await SchedulerManager.getInstance().runRecruitOnce("sria");
});
export const recruitSchedule_temp = onSchedule(tempConfig.schedule, async () => {
  await ready; await SchedulerManager.getInstance().runRecruitOnce("temp");
});
```
- ⚠️ Firebase 제약: `schedule`은 **배포 시점 확정** → 주기 변경 = redeploy.
- 로컬 E2E: `RUN_SCHEDULER_ONCE=true` → 양 소스 1회씩.
- `SchedulerManager`: 소스별 맵 키 `recruit:${source}`, `runRecruitOnce`/`startRecruitScheduler`/`stopRecruitScheduler`. `RecruitScheduler(source, workIntervalMs?)` 이름 `RecruitScheduler:${source}`, `performWork`가 `syncRecruits(source)` 호출.

### 2.6 소스별 diff — `services/`

- `recruitService.syncRecruits(source)`: 락 `lock:recruit:sync:${source}` → `fetchBySource(source)` → `setRecruitList(list, source)`.
- `recruitCacheService.setRecruitList(list, source?)`: `currentHashes`를 `id.startsWith("{source}:")`로 필터 → 삭제 판정을 그 소스 파티션에만 한정. `baselineExists = !!currentHashes && Object.keys(currentHashes).length>0`. `mapToJob`은 `job.id` 직접 사용.
- `recruitSourceService`: `fetchAll()`(allSettled·소스별 실패 격리·`dedupeById`) / `fetchBySource(source)`(단일, `getProvider`) / `isRequestAllowed()`(구 요청제한 승계). 요청제한 스토어 = `RedisManager.store.requestLimit`.
- 읽기 경로(`getRecruitList` 콜드캐시)는 `fetchAll` 전체 병합 baseline, 스케줄 경로만 소스별 diff.

### 2.7 임베드 방어적 읽기 — `providers/discord/builder/embeds/jobLink.ts`

```typescript
export const formatJobTitleLink = (title: string, url?: string) => url ? `[${title}](${url})` : title;
export function recruitField(r: Recruit, key: string): string {
  const v = (r as Record<string, unknown>)[key]; return v == null ? "" : String(v);
}
```
- sria는 타입상 필드 전부 존재, temp는 선언한 속성만 → union 접근 TS 에러 없이 "있으면 표시/없으면 빈문자". `recruitMessageEmbed`/`notificationMessageEmbed`가 `recruitField(item,"url"/"dayTxt"/"dDay"/"recruitmentStatus")` 사용.

### 2.8 명칭 통일 (crawl/proxy → source/sync)

| Before | After |
|--------|-------|
| `RECRUIT_CRAWL_*` / `RecruitCrawl*Event` | `RECRUIT_SYNC_*` / `RecruitSync*Event` |
| `CrawlCacheStore`/`CrawlKeyManager`/`SERVICE_NAME.CRAWL`/`store.crawl` | `RequestLimitStore`/`RequestLimitKeyManager`/`REQUEST_LIMIT`/`store.requestLimit` |
| `ErrorCategory.CRAWLER`/`crawlerFailed`/`CrawlerErrorContext`/`CrawlerStrategy` | `SOURCE`/`sourceFailed`/`SourceErrorContext`/`SourceStrategy` |
| `crawlerLogger`/`LogSource "crawler"`/`RecruitTier "crawler"` | `sourceLogger`/`"source"`/`"source"` |
| `CrawlerStrategy.PROXY`·`FirebaseCollection.PROXY`·`proxyUrl` | 제거 |

---

## 3. 데이터 설계

### 3.1 식별자·저장

| 항목 | 구조 | 용도 |
|------|------|------|
| `id` 규약 | `"{source}:{localId}"` (예 `sria:100034`, `temp:{tick}-{idx}`) | diff 식별자 + 소스 파티션 키 |
| Firestore `recruit/list` | `{ recruitList: Recruit[], lastRefreshedAt }` | 목록 캐시 + 성공 갱신 시각 |
| Redis 해시 | source별 sha256 해시 맵 | diff 비교 baseline |
| Redis 요청제한 | `request_limit:request_allowed` (TTL 600s) | 사용자 요청 10분 쿨다운 |

### 3.2 이벤트

| 이벤트 | 페이로드 | 발행 시점 |
|--------|---------|----------|
| `RECRUIT_SYNC_STARTED/COMPLETED/FAILED` | `RecruitSync*Event{schedulerName, totalCount?, duration?, error?}` | BaseScheduler runOnce 생명주기 |
| `RECRUIT_CHANGED` | `RecruitChangedEvent{addedJobs, updatedJobs, deletedIds}` | setRecruitList diff 발생 |
| `RecruitTier` | `"redis"\|"firestore"\|"source"\|"empty"\|"error"` | getRecruitList 응답 tier |

---

## 4. 구현 순서 (as-built — 구현 완료)

| 순서 | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | 타입 재작성 + 다운스트림 union 치환 | `common/types/recruit.d.ts`, `index.ts` 외 ~11파일 | ✅ |
| 2 | 프로바이더 계층 + 레지스트리 | `providers/recruit/**` | ✅ |
| 3 | sria 스냅샷 생성기 | `sria/*` | ✅ |
| 4 | temp 규칙 엔진 + spec + README | `temp/*` | ✅ |
| 5 | 소스별 sync/diff | `recruitSourceService`·`recruitCacheService`·`recruitService` | ✅ |
| 6 | 소스별 스케줄 | `schedulers/*`, `app/scheduler.ts` | ✅ |
| 7 | 임베드 union 대응 | `builder/embeds/*` | ✅ |
| 8 | 명칭 통일(source/sync) + PROXY 제거 | 다수(§2.8) | ✅ |
| 9 | 구 crawlers/·mock/·api/ 삭제 | — | ✅ |

---

## 5. 코딩 컨벤션 체크리스트

- [x] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [x] SystemLogger(`sourceLogger`/`providerLogger`) 사용 (console.log 금지)
- [x] SystemError 팩토리(`sourceFailed` 등, `SYSTEM_ERROR_*` 자동 발행)
- [x] EventBus 타입 안전(`emitEvent<T>`/`onEvent<T>`)
- [x] provider→services/features 참조 금지, services→providers 허용
- [x] dmSender 계약(DmPayload/DmSendResult) 불변
- [x] JSDoc(public API) + 한국어 주석

---

## 6. 테스트 계획

> 상세 런타임 검증 목록·(C)/(U) 분류는 `05-runtime-verification.md`.

| 검증 항목 | 방법 | 기대 결과 | 분류 |
|----------|------|----------|------|
| 타입/컴파일 | `npx tsc --noEmit` / `npm run build` | exit 0 | 전제 |
| 콘솔 테스트 3종 | `tsx` 직접 실행 | systemError/EventBus/BaseScheduler 통과 | (C) |
| temp 규칙 엔진 단위 | 임시 tsx 하네스 | 생성분포 ≈40/10/2/48, 진행도 감소, 모집종료 삭제, 확률삭제 영구, 경계 결정성 | (C) |
| 소스별 diff 분리 | `setRecruitList(list,"temp")` | deletedIds에 sria id 0건 | (C) |
| 다중소스 병합(읽기) | `fetchAll()` | sria+temp 병합·id 충돌 0 | (C) |
| 임베드 렌더 | 두 임베드 `Recruit` union 호출 | throw 없이 JSON 산출 | (C) |
| 소스별 E2E | 에뮬+Redis 2-run | 1회 NO_DATA→무DM, 2회 해당 소스만 CHANGED→DM | (U) |
| 실배포 트리거 | GCP 배포 후 스케줄 | `recruitSchedule_sria`/`_temp` 실발화 | (U) |

---

*작성일: 2026-08-15*
*개정: 2026-09-17 (mock 2차 재정의 — proxy 스코프 폐기)*
*참고: docs/phase-1-10/01-plan.md*

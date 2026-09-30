# Phase 1.10: 최소 base 스키마 + 사이트별 프로바이더·규칙 엔진 (mock 재정의)

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.2, 1.8, 1.13 완료

> **개정 이력(2026-09-15, 2차 재정의)**: 본 계획은 기존 "Proxy 통합 + 실 CRAWL 활성화 + 프로덕션 배포·E2E" 스코프를 **폐기**하고 mock 소스 프로바이더 구조로 전환한 것이다. 상세 설계는 `02-design.md`(mock), 승인 플랜은 `~/.claude/plans/jiggly-juggling-shannon.md` 참조.

---

## 개요

### 배경
이 프로젝트의 목적은 **포트폴리오**다. 실 크롤/프록시는 차단·법적 리스크(사람인 ToS/robots)·무료 프록시 품질 문제로 데모 안정성이 낮고 실가치도 크롤 자체가 아니다. 실가치는 **아키텍처**(3-tier 캐시·sha256 diff·EventBus·DM·스케줄러)에 있다. 따라서 크롤/프록시 계층을 완전히 제거하고, 공고 데이터를 **"여러 API 소스에서 불러오는" 프로바이더로 추상화**해 mock 소스로 파이프라인을 시연한다. 소스는 프로바이더 뒤에 있으므로 언제든 실 API로 교체 가능하다.

기존 1.10(proxy 통합, `check/95.3%`)은 이 pivot으로 폐기됐다.

### 목표
- **최소 공용 base**(`RecruitBase{id,title,source}`)로 스키마를 정직하게 분리하고, 사이트별 타입(`SriaRecruit`/`TempRecruit`)의 합집합 `Recruit`을 파이프라인 작업 타입으로 사용.
- 사이트 2곳: `sria`(스냅샷 반영), `temp`(커스텀 규칙 엔진). 소스는 프로바이더로 추상화.
- **소스별 스케줄 + 소스별 diff**(id 접두사 파티션)로 사이트 간 오삭제 방지.
- crawl/proxy 명칭을 실제 도메인(source/sync)으로 통일.

### 범위

| 포함 | 제외 |
|------|------|
| 타입 재작성(최소 base + 사이트별 union) + 다운스트림 union 치환 | 실 크롤/프록시 (완전 제거) |
| 프로바이더 계층(`RecruitProvider` + 레지스트리 `getProvider`/`getAllProviders`) | 실 API 연동 (프로바이더 뒤로 추상화만) |
| sria 스냅샷 생성기 (규칙 없음, 변화는 diff에 위임) | 임의 사이트 추가 (2곳 고정) |
| temp 규칙 엔진(stateless 결정적 시뮬레이션) + spec 시스템(tempTitles/tempFields) | AI/NLP·관리자 공지 등 타 Phase |
| 소스별 sync/diff(`syncRecruits(source)`·`setRecruitList(list,source)`·락) | dmSender 계약(DmPayload/DmSendResult) 변경 |
| 소스별 스케줄(`recruitSchedule_sria`/`_temp`) | 사용자 요청 3-tier 경로 회귀 |
| 임베드 union 대응(`recruitField` 방어적 읽기) | |
| 명칭 통일(source/sync) + 구 crawlers/·mock/·api/ 삭제 | |
| **(U)** 에뮬+Redis 2-run E2E (NO_DATA→무DM / CHANGED→DM) | |

---

## 요구사항

### 기능 요구사항
1. **최소 base + 사이트별 타입**: `RecruitBase{id,title,source}`만 공용. `SriaRecruit`(url/dDay/dayTxt/recruitmentStatus)·`TempRecruit`(동적 인덱스 시그니처)은 base 확장, `Recruit` union이 작업 타입. `id="{source}:{localId}"`가 diff 식별자 겸 소스 파티션 키.
2. **프로바이더 추상화**: `RecruitProvider{ readonly source; fetch():Promise<Recruit[]> }` + 레지스트리. `getProvider(source)`(소스별 스케줄), `getAllProviders()`(읽기 병합).
3. **sria(일반)**: 값 pool 스냅샷 반환(실 API 응답 모사). 규칙 없이 변화 감지는 diff에 위임.
4. **temp(규칙 엔진)**: stateless 결정적 시뮬레이션 — 생성 40/10/2/48%, 수정(진행도 확정 + 30% 확률), 삭제(모집종료 확정 + 10% 확률 영구). 시드 PRNG(FNV+fmix32), 경계 `t=floor(now/unitMs)`.
5. **temp spec 시스템**: 인터페이스 비움. 입력 = `tempTitles`(제목 후보=필수) + `tempFields`(추가 속성: 포함 무조건/확률 + 값 고정/풀). 사용자는 **제목만 추가**하면 생성기가 나머지 생성.
6. **소스별 스케줄 + diff**: 사이트마다 `onSchedule(<config>.schedule)`. `syncRecruits(source)` 락 `lock:recruit:sync:{source}`, `setRecruitList`가 삭제 판정을 `id` 접두사로 파티션.
7. **임베드 union 대응**: `recruitField(r,key)`로 방어적 읽기(sria 전 필드/temp 선언 속성만), 링크는 `url`.
8. **명칭 통일**: `RECRUIT_SYNC_*`·`ErrorCategory.SOURCE`/`sourceFailed`·`sourceLogger`·tier `"source"`·`RequestLimitStore`. PROXY 잔재 제거.

### 비기능 요구사항
- **결정성**: temp는 순수 함수(같은 now → 같은 목록). Math.random 미사용.
- **호환성**: dmSender 계약 불변, 사용자 3-tier 경로 회귀 없음, 빌드/타입 정합.
- **에러 처리**: SystemError 패턴, sourceLogger/providerLogger 사용.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js 18) |
| Language | TypeScript (strict mode) |
| Database | Firestore + Redis (3-tier 캐시·diff·락) |
| 소스 | mock 프로바이더 (`.ts` 데이터 파일 — sriaPostings/tempTitles/tempFields) |
| Messaging | discord.js 14.17 (REST) |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |
| 검증 런타임 | tsx (콘솔 테스트·규칙 엔진 하네스) |

---

## 구현 전략

### 접근 방식
공고 스키마를 **최상위 최소 base → 사이트별 인터페이스 확장**의 디자인 패턴으로 추상화한다. 일반 사이트(sria)는 실 API처럼 스냅샷만 반환하고 변화 감지는 기존 diff 엔진에 맡긴다. 커스텀 규칙은 temp에만 두되, serverless(상태 비저장)에서도 재현 가능하도록 **시각 `now`의 순수 함수**(시드 PRNG 결정적 시뮬레이션)로 구현한다 — diff 엔진이 직전 저장분과 비교해 규칙대로 added/updated/deleted를 발화한다. temp 속성은 spec(포함/값 규칙)으로 동적 부여해, 사용자가 제목만 추가해도 생성기가 완성한다.

### 데이터 흐름 (서버 첫 실행)
```
onSchedule_{sria,temp} → runRecruitOnce(source) → syncRecruits(source)[락]
  → fetchBySource(source) → getProvider(source).fetch()
       ├ SriaMockProvider → generateSriaRecruits()      (스냅샷)
       └ TempMockProvider → generateTempRecruits(now)   (규칙)
  → setRecruitList(list, source)  [sha256 diff, id 접두사 "{source}:" 파티션]
  → RECRUIT_CHANGED → NOTIFICATION_SEND → dmSender(REST) → 구독자 DM
[첫 실행] baseline 없음 → 전량 added로 잡히되, 첫 tick은 NO_DATA 처리로 DM 억제(2-run E2E로 검증)
```

### 영향 받는 파일 (요약)
| 영역 | 파일 | 변경 |
|------|------|------|
| 타입 | `common/types/recruit.d.ts`(+index) | 재작성 (RecruitData/ProviderRecruit 삭제) |
| 프로바이더 | `providers/recruit/**` | 신규 계층 (sria/·temp/·레지스트리) |
| 서비스 | `recruitSourceService`·`recruitCacheService`·`recruitService` | 신규/수정 (소스별 sync/diff) |
| 스케줄 | `schedulers/*`·`app/scheduler.ts` | 소스별 인스턴스·export |
| 이벤트/에러/로거 | `events/bus/*`·`common/utils/systemError·systemLogger` | source/sync 명칭 통일 |
| 임베드 | `providers/discord/builder/embeds/*` | union 대응(recruitField) |
| 삭제 | `crawlers/**`·`providers/recruit/{mock,api}/**` | 제거 |

### 의존성 분석
- **의존(선행 완료)**: 1.2(스케줄러 이벤트), 1.8(dmSender 계약), 1.13(onSchedule·runRecruitOnce·diff·REST dmSender).
- **후속 영향**: 실 API 도입 시 프로바이더 arm만 교체(파이프라인 무변경).

---

## 성공 기준

- [ ] 최소 base + 사이트별 union 타입으로 다운스트림이 컴파일 (RecruitData/ProviderRecruit 제거)
- [ ] sria 스냅샷·temp 규칙 엔진이 각각 `Recruit[]` 반환, id 충돌 0
- [ ] temp 생성 분포 ≈40/10/2/48%, 진행도 확정 감소, 모집종료 삭제, 확률삭제 영구, 경계 결정성
- [ ] 소스별 diff: `syncRecruits("temp")` 시 sria 공고가 deletedIds에 없음
- [ ] 소스별 스케줄 export(`recruitSchedule_sria`/`_temp`)가 각 config.schedule로 발화
- [ ] 임베드 union 정상 렌더 (recruitField 방어적)
- [ ] crawl/proxy 활성 심볼 0 (명칭 통일)
- [ ] TypeScript 컴파일 + `npm run build` 성공 + 정적 analyze 통과
- [ ] 기존 기능 회귀 없음 (사용자 요청 3-tier 경로)
- [ ] **(U)** 에뮬+Redis 2-run E2E: 1회 NO_DATA→무DM, 2회 해당 소스만 CHANGED→DM

### (U) 런타임검증 체크리스트 (analyze 통과 후 · review-process 0단계)
- 상세는 `05-runtime-verification.md`(MC-U1 / OP-U1~U2) 참조

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| mock이 실 데이터 흐름을 충분히 대변하지 못함 | 중간 | 규칙 엔진이 생성/수정/삭제 전 케이스를 diff로 발화 → 파이프라인 전 구간 자극 |
| 첫 실행 baseline 부재로 전량 added → 과다 DM | 중간 | 첫 tick NO_DATA 처리로 DM 억제, 2-run E2E로 검증 |
| Firebase schedule 배포 시점 고정 | 낮음 | 주기 변경 = redeploy 명시 (문서화) |
| 데이터 파일 JSON→lib 미복사 gotcha | 낮음 | `.ts` 데이터 파일 채택(복사 단계 불필요) |

---

*작성일: 2026-08-15*
*개정: 2026-09-17 (mock 2차 재정의 — proxy 스코프 폐기)*
*시드: .claude/phases/phase-1-core.md*

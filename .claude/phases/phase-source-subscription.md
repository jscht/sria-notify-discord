# Phase 시드 — 멀티 source 구독 설계

> **상태**: 설계 확정(미착수). 구현은 **dev 기반 하위 브랜치 + 별도 세션**.
> **착수 절차**: `git checkout dev && git pull` → `feature/phase-X.Y-source-subscription` 분기 → `/pdca next`로 phase 번호 확정 → `/pdca plan X.Y`에 본 문서를 시드로 투입.
> **작성**: 2026-10-09 (설계 세션). 본 문서가 핸드오프 정본이다.

---

## Context

**왜**: `RecruitSource`("sria" | "temp")는 현재 **수집·스케줄·diff까지만 1급 축**이고(양쪽 소스 모두 스케줄·동기화·소스별 diff 파티션 완비), **구독·알림·표시는 전부 sria 단일 전제**다.
- 구독 모델(`AlarmSubscription`)에 source 필드 없음 → 구독자는 source를 고를 수 없음.
- fan-out(`notificationService`)이 전 구독자에게 모든 source를 지역 필터만 걸어 전달.
- embed가 sria 형태 고정·source-blind → temp를 켜면 전 구독자가 sria 템플릿으로 렌더된 temp 공고까지 자동 수신(temp의 `badge`/동적필드는 아예 안 보임).

**목표**: source를 **독립 구독 축**으로 승격 + 이기종 소스를 섞어 보낼 때의 **통합 표시 계약(DTO)** 도입 + **temp 스키마 정리**.

---

## 설계

### 1. 구독 모델 — 독립 `AlarmFilter` 합성 (결합 제거)

지역 축과 소스 축은 **서로 의존 없는 독립 축**이므로, 축 하나를 자립형 필터로 빼고 AND로 합성한다.

```ts
// common/types/alarmSubscription.ts
// 축 1개의 공통 모양 — 지역·소스가 동일 틀 재사용
export type AlarmFilter<T> =
  | { mode: "ALL" }                    // 전체 (values 불필요)
  | { mode: "SELECTED"; values: T[] }; // 선택 (min 1, 0개 저장 차단)

export interface AlarmSubscription {
  userId: string;
  enabled: boolean;
  regions: AlarmFilter<CityEn>;        // 기존 alertMode+regions를 흡수
  sources: AlarmFilter<RecruitSource>; // 신규 축
  createdAt: number;
  updatedAt: number;
}
```

- **하위호환(read-time 매핑, 마이그레이션 불필요)** — `providers/firebase/store/subscription.ts`의 `toAlarmSubscription`에서:
  - 옛 `{ alertMode, regions[] }` → `regions = alertMode==="ALL" ? {mode:"ALL"} : {mode:"SELECTED", values:regions}`
  - `sources` 필드 부재 → `{ mode:"ALL" }` (기존 구독자는 현 동작 그대로 전 source 수신)
- Firestore 저장 스키마도 중첩형(`regions:{mode,values}`, `sources:{mode,values}`)으로 전환. 쓰기 메서드(`updateAlertMode`/`updateAlertRegions` 등)는 필터 단위 갱신으로 재정의.
- 기존 `AlertMode` enum(ALL/SELECTED)은 `AlarmFilter.mode` 리터럴로 재사용/정리.

### 2. 통합 표시 — `RecruitDisplay` DTO + 소스별 `toDisplay()`

embed가 소스 스키마를 직접 읽지 않도록 **얇은 공통 계약**으로 디커플.

```ts
// common/types/recruit.d.ts (신규)
export interface RecruitDisplay {
  sourceLabel: string;                             // SourceConfig.displayName
  title: string;
  url?: string;                                    // 없으면 평문 제목
  period?: string;                                 // 모집 기간/진행도
  extraFields?: { name: string; value: string }[]; // 소스 고유값 수용구
}
```

- 각 프로바이더가 `toDisplay(recruit): RecruitDisplay` 제공:
  - `sria.toDisplay` → `{ sourceLabel, title, url, period: dayTxt, extraFields:[{name:"마감",value:dDay},{name:"상태",value:recruitmentStatus}] }`
  - `temp.toDisplay` → `{ sourceLabel, title, period, extraFields: fields }`
- embed(`providers/discord/builder/embeds/**`)는 **`RecruitDisplay`만 렌더** → 소스 추가에도 embed 불변. source별 섹션 그룹핑 또는 항목별 소스 배지로 구분.
- overflow "전체 공고" 링크의 `ENV.SRIA_URL` 하드코딩 제거 → `SourceConfig.url`(아래 4).

### 3. temp 인터페이스 트리밍

> 이 절의 `period` 변동 설계는 대체되었다. 최종 설계는 `docs/phase-1-15/02-design.md` §2.6을 따른다.

temp의 `dDay`/`dayTxt`/`recruitmentStatus`는 sria 흉내 파생값이고 **존재 목적은 "틱마다 해시가 바뀌어 updated diff를 유발"**(`tempRule.ts:114` 주석). `period` 1개만 시변 필드로 남겨 diff churn을 유지하고 나머지는 제거.

```ts
// common/types/recruit.d.ts
// 현재: TempRecruit extends RecruitBase { source:"temp"; [key:string]: unknown }
export interface TempRecruit extends RecruitBase {   // RecruitBase = { id, title, source }
  source: "temp";
  period?: string;                                   // "모집 8틱 · 경과 3틱" — 유일한 시변 필드
  fields?: { name: string; value: string }[];        // badge 등 선택 속성
}
```

- `providers/recruit/temp/tempRule.ts:110-130` 생성부: `dDay`/`recruitmentStatus`/`url` 제거, `dayTxt`→`period`로 이름/의미 정리, `badge:"급구"`(`:123`)는 `fields`에 `{name:"badge",value:"급구"}`로 push. 느슨한 index signature 제거.
- `period`가 틱마다 변해 updated-diff 경로 유지(제거 시 added/deleted만 발화 → 테스트에서 updated 경로 별도 커버 필요).

### 4. 노출 게이트 — `SourceConfig.userFacing`

sria·temp 모두 현재 mock 프로바이더. temp가 "이기종 소스 데모"인지 "실 노출 소스"인지에 따라 구독 노출을 플래그로 제어(수집·스케줄과 무관).

- `providers/recruit/index.ts`의 `SOURCE_CONFIGS` 각 엔트리에 **`displayName` / `url` / `userFacing`** 추가(표시 메타 단일 진실원).
- 구독 SelectMenu 옵션은 `userFacing===true`인 소스만으로 생성.
- fan-out에서 `sources.mode==="ALL"`의 의미 = **"userFacing 소스 전부"**(숨긴 소스가 ALL 구독자에게 새지 않도록).
- 기본 권장: `sria.userFacing=true`. temp는 제품 판단에 따라(dev 노출/ prod 숨김 등) 설정.

### 5. 추가 설계 4가지 (무엇 / 어디서 / 어떻게)

1. **SourceConfig 표시 메타** — `providers/recruit/index.ts` `SOURCE_CONFIGS`에 `displayName`/`url`/`userFacing`. 쓰임 ①구독 메뉴 라벨·노출 ②embed `sourceLabel` ③overflow 링크 url ④fan-out ALL 해석. 소스 추가 = 이 엔트리 한 줄.
2. **소스 필터 = 독립 유닛** — `common/utils/recruitFilter.ts`에 `AlarmFilter<RecruitSource>` 평가 함수를 지역 필터와 대칭으로 추가. fan-out(`notificationService.notifyNewRecruits`)에서 지역 필터와 **AND** 합성. 판정은 `job.source`(이미 `RecruitBase.source` 보유)로 — 추가 데이터 배관 0. 두 필터는 서로 모름(독립 테스트·AND 확장).
3. **recruitRequest stub — 이번 범위 밖(별도 phase)** — `features/recruitRequest/**`는 전 메서드 `return null`·로컬 `Recruit` 재정의(source 없음)·`SRIA_URL` 하드코딩인 미완 stub. 이번엔 손대지 않되, `RecruitDisplay`/`SourceConfig`를 나중에 재사용할 수 있게 설계만 해둠.
4. **멀티소스 테스트** — 현재 0건(fixture 전부 sria: `test/mocks/sriagent/*.json`). temp fixture 신설 + 커버: ①교차 diff 파티션(temp 변경이 `sria:` 파티션 불간섭) ②`toDisplay` 매핑(특히 temp `fields`→`extraFields`) ③구독 매칭("sria만/temp만/둘다/ALL") ④노출 게이트(`userFacing=false`가 ALL에 안 샘).

---

## 변경 파일 (대표)

| 파일 | 변경 |
|------|------|
| `common/types/alarmSubscription.ts` | `AlarmFilter<T>` 신설, `AlarmSubscription` 재구성, `AlarmSubscriptionInput` 동반 |
| `common/types/recruit.d.ts` | `RecruitDisplay` 추가, `TempRecruit` 트리밍 |
| `providers/recruit/index.ts` | `SOURCE_CONFIGS`에 `displayName`/`url`/`userFacing` |
| `providers/recruit/{sria,temp}/**` | `toDisplay()` 구현, `tempRule.ts:110-130` 트리밍 |
| `common/utils/recruitFilter.ts` | 지역·소스 독립 필터 + AND 합성 |
| `services/notificationService.ts` | fan-out에 소스 필터 AND, ALL=userFacing 해석 |
| `providers/firebase/store/subscription.ts` | 중첩 스키마 매핑 + 하위호환 read-time 기본값 |
| `features/alarmSubscribe/**` | 구독 UI에 source SelectMenu(복수, min 1), 0개 차단 |
| `providers/discord/builder/embeds/**` | `RecruitDisplay` 기반 렌더, overflow 링크=`SourceConfig.url` |
| `src/**/__test__/`, `test/mocks/**` | temp fixture + 멀티소스 테스트 |

---

## 검증 (end-to-end)

- **정적**: `cd functions && npm run build`(tsc 0) + lint 0. 타입 재구성이 많아 `AlarmSubscription` 참조 지점 전수 컴파일 확인이 1차 게이트.
- **단위**: 위 멀티소스 테스트 4커버 통과.
- **로컬 E2E(2-run)**: `RUN_SCHEDULER_ONCE=true node lib/app/scheduler.js` — run A(기준선 적재) → 특정 공고 해시 1건 제거 → run B에서 added→CHANGED→`RECRUIT_CHANGED`→`notifyNewRecruits`→**소스+지역 AND 필터**→매칭 구독자에게만 발송. "sria만/temp만/ALL" 구독자별로 올바르게 분기되는지 로그로 판정. (로컬 Redis·실 Firestore, 구독자=본인 계정 범위 내)
- **하위호환**: source 필드 없는 기존 Firestore 구독 문서가 read-time에 `sources:{mode:ALL}`로 해석되어 전 source 수신 유지되는지 확인.

---

## 범위 밖 / 미룬 것

- `recruitRequest` stub 완성 → 별도 phase.
- `tempFields.ts`가 빈 배열인 건(동적필드 미구성) 이번 스펙과 독립 — temp `fields` 경로는 본 설계로 렌더 가능해지나, 실제 필드 정의 추가는 선택.

## 핸드오프 체크

- [ ] 다른 세션: dev 최신화 후 `feature/phase-X.Y-source-subscription` 분기
- [ ] `/pdca next` → phase 번호 확정 → `/pdca plan X.Y`에 본 문서 반영
- [ ] 커밋/PR에 `Claude-Session:`·`claude.ai/code` 링크 금지(git-workflow.md 정본)

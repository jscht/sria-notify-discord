# Phase 1.15 설계서: 멀티 source 구독

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-15/01-plan.md`, 시드 `.claude/phases/phase-source-subscription.md`
**사용자 결정 반영**: 2026-10-10 승인분 (저장 형식, 발송 판정 순서, 기타 결정), 2026-10-10 추가 결정 (모드만 바꿀 때 지역 목록 유지, 두 소스 모두 노출, 소스 이름 temp → elias, elias 제목에 지역 따로 적기, 표시 이름, 사용자 문구 용어), 2026-10-10 UI 결정 (사용자 문구 "사이트", 첫 구독 사이트 질문, 설정 관리 화면의 지역·사이트 버튼, embed 간단히/자세히), 2026-10-12 추가 결정 (elias 모집 기간을 실제 날짜로 고정, elias 상태 "접수중"→"종료" 전환, "급구" 표시 삭제, `RecruitDisplay.status` 추가, "종료" 공고 알림 제외, `updateSources`도 문서 존재 확인, 사이트 메뉴 안내 문구, 기간 표시 형식 유지, 첫 구독 순서 유지, README 속성 안내), 2026-10-14 추가 결정 (elias 생성 규칙 재설정과 종료·제거 확률 분리, 게시자 `postedBy`, 기간 형식 `YYYY.MM.DD` 통일 — 10-12의 "기간 표시 형식 유지"를 대체, 최신순 정렬, DM 안내 문구, 알림 전용 스케줄러 2시간, sria 갱신 2시간, 사이트 공고 0건 처리), 2026-10-27 추가 결정 (바뀐 공고가 있으면 구독 조건에 맞는 공고 전체를 DM으로 보냄, DM 정렬 접수중 → 발표중 → 종료 + 같은 상태 안 최신순 — 10-12의 "종료" 공고 알림 제외를 대체, 송신 실패 구독자 따로 저장 안 함, 작성 시각 `postedAt?`, 제목에 `[지역][상태]` 표시, 알림 스케줄러가 Firestore 공고 목록 저장, 예약 실행 작업 목록 한 곳 `SCHEDULED_JOBS`), 2026-10-29 추가 결정 (공고 조회의 저장 경로를 `syncRecruits`로 통일, Firestore 목록은 읽기만), 2026-10-31 추가 결정 (알림 시각 06~20시 짝수 정시, 지난 알림 때 목록 만료 없음, 사이트 동시 갱신, 실패로 빈 목록이면 저장 안 함, 게시자는 공고 조회 둘째 줄에만 표시, elias 지역 `요정 왕국`·`세계수 교단`과 공고 2줄), 2026-11-01 추가 결정 (사이트 갱신 대기 초과는 실패로 처리, 운영 실행은 `runOnce()` 유지, 일부 사이트 복구 뒤 DM이 한 번 더 나가는 경우 허용, 서비스 객체는 처음 쓸 때 만들고 생성자로 받음, 예약 작업 `run`은 처리 건수를 돌려줌, 테스트의 사이트 락 대기는 10초)
**런타임 검증 뒤 변경** (2026-11-03 사용자 결정): 사이트 선택 메뉴와 첫 구독 사이트 질문을 없애고 공고 묶음 켜기/끄기로 바꾼다(§2.9.5, §2.9.6). 정렬은 시작 시각까지 비교한다(§2.7). 2026-11-05: 지역 모드가 ALL이면 열어 둔 옛 메시지에서 지역을 저장하지 않는다(§2.9.5). 첫 구독은 일반 공고만 켠다(§2.9.6).
**계획서와 달라진 범위**: 공고 조회 커맨드(`onRecruitRequest.ts`, `recruitMessageEmbed.ts`)를 이번 범위에 넣는다 (2026-10-10 사용자 결정, §2.9.4). `features/recruitRequest/**`는 계속 범위 밖이다.

> 경로 표기: 별도 표시가 없으면 `functions/src/` 기준이다.
>
> 용어: 코드와 이 문서에서는 공고 출처를 "소스"(`RecruitSource`)라고 부른다. 사용자에게 보이는 문구에서는 "사이트"라고 쓴다. 자세한 문구는 §2.9에서 정한다.

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Types (`common/types/`) | `AlarmFilter<T>` 추가, `AlarmSubscription` 재구성, `RecruitDisplay`·`DisplayField` 추가, 공통 `postedBy`·`postedAt?` 추가, `TempRecruit` → `EliasRecruit` 이름 변경·정리 |
| Common Utils (`common/utils/`) | 소스 필터·노출 소스 필터 추가, 지역 필터를 `AlarmFilter` 입력으로 변경, `selectedValues()`·`getStartDate()`·`getRecruitStatus()`·최신순 정렬·알림 정렬(상태순 + 최신순) 추가 |
| Providers — Firestore (`providers/firebase/store/subscription.ts`) | 새 저장 형식 읽기·쓰기, 옛 형식 읽기 변환, 지역 모드만 바꾸는 쓰기와 필드 전체 교체 쓰기 |
| Providers — 공고 소스 (`providers/recruit/`) | 소스 이름 temp → elias (§2.11), `SourceConfig`에 `displayName`·`url`·`userFacing`·`ownRegionGroup` 추가, 소스별 `toDisplay()`, elias 생성 규칙 정리(모집 기간 고정, 종료·제거 확률 분리, 게시자, "급구" 표시와 `editProb` 삭제), sria `postedBy`·`postedAt?`·갱신 주기 120분 |
| Common Constants (`common/constants/city.ts`) | elias 전용 지역 권역 `eliasRegions` 추가 (§2.6) |
| Providers — Redis (`providers/redis/`) | 지난 알림 때 목록·사이트별 마지막 갱신 시각 키 추가 (§2.8.2) |
| App (`app/scheduler.ts`), Schedulers (`schedulers/`) | 예약 실행 작업 목록 `SCHEDULED_JOBS` 한 곳에서 운영 함수·로컬 1회 실행·로컬 계속 실행을 만듦, 알림 작업 추가, `RecruitScheduler`를 범용 스케줄러로 변경 (§2.8.2), 소스 이름 변경에 따른 배포 함수 이름 수정 (§2.11) |
| Services (`services/notificationService.ts`, `recruitService.ts`, `recruitSourceService.ts`) | 알림 스케줄러(강제 갱신 → 비교 → 판정 ①~⑤ → 발송), 구독자별 try/catch, `RecruitDisplay` 변환, 사이트 공고 0건 처리 (§2.8, §2.12), 공고 조회의 저장 경로를 `syncRecruits`로 통일 (§2.8.4) |
| EventBus (`events/bus/`) | `NOTIFICATION_SEND` 데이터를 `{ userId, displays, settings }`로 변경, 발송 핸들러 대응, `RECRUIT_CHANGED` → 즉시 발송 연결 해제 |
| Features (`features/alarmSubscribe/services/`) | 구독 서비스 쓰기 메서드를 필터 단위로 변경, 소스 필터 저장 메서드 추가 |
| Discord UI (`providers/discord/builder/**`, `events/listeners/**`) | 공고 켜기/끄기 화면, 첫 구독 흐름, 설정 관리 화면, 공고별 지역 표시, 공고 목록 그리기(간단히/자세히) — §2.9 |

### 1.2 컴포넌트 다이어그램

```
[사이트 갱신 RecruitScheduler(source)]  sria 2시간 · elias 30분
   recruitService.syncRecruits(source)  (사이트 락 lock:recruit:sync:{source})
     → recruitCacheService.setRecruitList(list, source)  소스별 비교(id 접두사 "{source}:")
     → recruit:lastSync:{source} 저장
     → RECRUIT_CHANGED 발행 (로그·기록용. DM은 보내지 않음)

[알림 스케줄러 runNotification]  매일 06~20시 짝수 정시 (한국 시간)
   0. 알림 락 lock:notification (못 잡으면 종료)
   1. 사이트마다 동시에 강제 갱신 (최근 5분 안 갱신이면 건너뜀, 사이트 락이 잡혀 있으면 풀릴 때까지 대기)
      (갱신에 실패한 사이트가 있고 최신 공고 목록이 비어 있으면 저장 없이 끝)
   2. Redis 최신 공고 목록 ↔ 지난 알림 때 목록 비교 → 바뀐 공고 ID (새로 생김·내용 바뀜·마감으로 바뀜)
      (지난 알림 때 목록이 없으면 저장만 하고 끝)
   ① filterVisibleSources(최신 공고 목록, getUserFacingSources())  ← 한 번만
   ② sortForNotification(jobs) (접수중 → 발표중 → 종료, 같은 상태 안은 최신순. 뒤 필터는 순서를 유지) ← 한 번만
   for 구독자 (구독자마다 try/catch):
     ③ filterBySource(jobs, expandSourceFilter(sub.sources))
     ④ filterByRegion(jobs, sub.regions)
        구독 조건에 맞는 공고 중 바뀐 공고가 없으면 건너뜀
     ⑤ jobs.map(j => toDisplay(j.value))  → RecruitDisplay[] (바뀌지 않은 공고도 함께)
        ▼
     NOTIFICATION_SEND { userId, displays, settings }
        ▼
     [NotificationSendHandler] → embed 빌더(RecruitDisplay만 읽음) → sendNotificationDM
   3. 지난 알림 때 목록 저장 (발송이 끝난 뒤)
   4. Firestore 공고 목록 저장 (실패해도 알림은 정상 종료)
   5. 알림 락 해제

[SubscriptionStore] ⇄ Firestore users/{userId}/notifications/settings
   읽기: 옛 형식 {alertMode, regions[]} → 새 형식으로 변환
   쓰기: 새 형식만, alertMode 삭제
         지역 모드만 변경 → "regions.mode"만 바꿈 (지역 목록 유지)
         지역 목록 변경·처음 저장 → 필드 전체 교체
```

---

## 2. 상세 설계

### 2.1 구독 타입

**파일**: `common/types/alarmSubscription.ts`, `common/types/index.ts`

```typescript
// 기존 유지: AlertMode = { ALL: "ALL", SELECTED: "SELECTED" } as const
// 버튼 ID(alertModeSelectActionId)와 같은 값을 쓰기 위해 mode 값으로 그대로 재사용한다.

/** 구독 조건 하나(지역 또는 소스)의 공통 모양. */
export type AlarmFilter<T> =
  | { mode: typeof AlertMode.ALL }
  | { mode: typeof AlertMode.SELECTED; values: T[] };

export interface AlarmSubscription {
  userId: string;
  enabled: boolean;
  regions: AlarmFilter<CityEn>;
  sources: AlarmFilter<RecruitSource>;
  createdAt: number;
  updatedAt: number;
}

export type AlarmSubscriptionInput = Pick<AlarmSubscription, "enabled" | "regions" | "sources">;
```

- `index.ts`에 `AlarmFilter` 타입 export를 추가한다.
- `values`의 "최소 1개"는 타입으로 강제하지 않는다. 지역은 지금도 "선택 지역 + 0개" 상태가 정상 흐름에 있다(`onEnableSelectedRegionAlert.ts:32-36`, `subscribeClear.ts:30`). 이 상태는 지금처럼 알림 0건으로 동작한다. 소스 0개 저장은 구독 서비스(§2.3)와 UI에서 막는다.

**보조 함수** — 신규 `common/utils/alarmFilter.ts`

```typescript
/** SELECTED면 values, ALL이면 빈 배열. UI가 "현재 선택 목록"을 읽을 때 쓴다. */
export function selectedValues<T>(filter: AlarmFilter<T>): T[];
```

`sub.regions`를 배열로 읽던 UI 코드는 이 함수로 바꾼다(§2.10 바꿔 쓰기 규칙).

### 2.2 저장 형식 (Firestore 구독 문서)

**파일**: `providers/firebase/store/subscription.ts`

#### 읽기 — `toAlarmSubscription`

```typescript
function toAlarmSubscription(userId, data): AlarmSubscription {
  return {
    userId,
    enabled: data.enabled,
    regions: readRegions(data, userId),
    sources: readFilter<RecruitSource>(data.sources, ALL_FILTER, "sources", userId),
    createdAt: (data.createdAt as Timestamp).toMillis(),
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
  };
}

function readRegions(data, userId): AlarmFilter<CityEn> {
  // (a) 옛 형식 구분: regions가 배열이면 옛 형식 {alertMode, regions[]}
  if (Array.isArray(data.regions)) {
    return data.alertMode === AlertMode.ALL ?
      { mode: "ALL" } :
      { mode: "SELECTED", values: data.regions };
  }
  return readFilter<CityEn>(data.regions, EMPTY_SELECTED, "regions", userId);
}

function readFilter<T>(raw, fallback, field, userId): AlarmFilter<T> {
  if (raw === undefined) return fallback;                       // 필드 없음
  if (raw?.mode === "ALL") return { mode: "ALL" };              // values는 무시
  if (raw?.mode === "SELECTED" && Array.isArray(raw.values)) {
    return { mode: "SELECTED", values: raw.values };
  }
  providerLogger.warn("구독 필터 형식 오류 — 기본값으로 읽음", { userId, field });
  return fallback;
}
```

| 필드 상태 | 읽은 결과 |
|-----------|----------|
| `regions`가 배열 + `alertMode: "ALL"` | `{ mode: "ALL" }` (배열 값은 무시) |
| `regions`가 배열 + `alertMode: "SELECTED"` | `{ mode: "SELECTED", values: regions }` |
| `regions`가 `{mode, values?}` | 그대로. mode가 ALL이면 `values` 무시 |
| `regions` 없음 | `{ mode: "SELECTED", values: [] }` (알림 0건 쪽으로 안전하게) |
| `regions` 형식 오류 | `{ mode: "SELECTED", values: [] }` + 경고 로그 |
| `sources` 없음 | `{ mode: "ALL" }` (기존 구독자는 지금처럼 모든 노출 소스를 받음) |
| `sources` 형식 오류 | `{ mode: "ALL" }` + 경고 로그 |

#### 쓰기 — 모드만 변경 / 필드 전체 교체

(b) `set(..., {merge: true})`는 중첩 객체를 필드 단위로 합친다(근거: `subscription.ts:81`). 어떤 값이 남는지 호출마다 달라지므로, 쓰기는 아래 두 방식만 쓴다.

| 쓰기 방식 | 쓰는 경우 | Firestore 호출 |
|-----------|----------|---------------|
| 지역 모드만 변경 | ALL ↔ SELECTED 전환 | `update({ "regions.mode": mode, updatedAt })` — 필드 경로로 `mode`만 바꾼다. `values`는 남는다 |
| 필드 전체 교체 | 지역 목록 변경, 소스 필터 변경, 처음 저장 | `update({ regions: {...} })` 또는 `set(...)`(merge 없음) — 최상위 필드 이름을 키로 주면 그 필드 값 전체가 바뀐다 |

- 모드만 바꿀 때 지역 목록을 남기는 이유: ALL로 바꿨다가 SELECTED로 돌아오면 이전 지역이 그대로 복원된다. 지금 동작과 같다. 읽을 때 mode가 ALL이면 `values`를 무시하므로(§2.2 읽기) 남은 목록이 발송에 영향을 주지 않는다.
- `regions`를 쓸 때는 두 방식 모두 `alertMode: FieldValue.delete()`를 같이 보낸다.
- 저장하는 필터에는 ALL이어도 항상 `values` 배열을 넣는다(처음 저장할 때는 `[]`). 그래야 모드만 SELECTED로 바꿨을 때 `values`가 없는 문서가 생기지 않는다. `values: undefined`는 Firestore가 거부하므로 쓰지 않는다.

```typescript
/** 도메인 필터 → 저장용 객체. ALL이면 values는 빈 배열. */
function toStoredFilter<T>(f: AlarmFilter<T>) {
  return f.mode === "ALL" ? { mode: "ALL", values: [] } : { mode: "SELECTED", values: f.values };
}
```

**옛 형식 문서에서 모드만 바꿀 때** — 옛 문서는 `regions`가 배열이라 `"regions.mode"` 경로를 바로 쓸 수 없다. `updateRegionMode`는 문서를 먼저 읽고 형식에 따라 나눈다.

```typescript
async updateRegionMode(userId: string, mode: AlertMode): Promise<void> {
  const ref = this.getSettingsRef(userId);
  const data = (await ref.get()).data();
  if (Array.isArray(data?.regions)) {
    // 옛 형식: 배열을 values로 옮기며 새 형식으로 바꾼다 (지역 목록 유지)
    await ref.update({ regions: { mode, values: data.regions }, alertMode: FieldValue.delete(), updatedAt });
    return;
  }
  await ref.update({ "regions.mode": mode, alertMode: FieldValue.delete(), updatedAt });
}
```

- 문서가 없으면 지금처럼 `update()`가 NOT_FOUND를 던진다.
- 같은 사용자가 모드 버튼을 동시에 누르면 마지막 쓰기가 남는다. 바뀌는 값이 `mode` 하나라 트랜잭션은 쓰지 않는다.

| 메서드 | 변경 | 동작 |
|--------|------|------|
| `getNotificationSettings(userId)` | 유지 | 반환 타입만 새 `AlarmSubscription` |
| `setNotificationSettings(userId, input)` | 수정 | 문서 있음 → `update({ enabled, regions, sources, alertMode: delete, updatedAt })` / 문서 없음 → `set({ enabled, regions, sources, createdAt, updatedAt })` (merge 없음) |
| `updateAlertMode` | **삭제** | `updateRegionMode`로 대체 |
| `updateAlertRegions` | **삭제** | `updateRegionFilter`로 대체 |
| `updateRegionMode(userId, mode: AlertMode)` | 신규 | 지역 모드만 변경. 위 코드 참조 (새 형식은 `"regions.mode"`, 옛 형식은 배열을 `values`로 옮겨 교체) |
| `updateRegionFilter(userId, filter: AlarmFilter<CityEn>)` | 신규 | 필드 전체 교체. `update({ regions: toStoredFilter(filter), alertMode: FieldValue.delete(), updatedAt })` |
| `updateSourceFilter(userId, filter: AlarmFilter<RecruitSource>)` | 신규 | `update({ sources: toStoredFilter(filter), updatedAt })` — `regions`는 건드리지 않으므로 `alertMode`도 지우지 않는다 |
| `toggleNotificationEnabled` | 유지 | |
| `getAllActiveSubscribers()` | 유지 | 문서마다 `toAlarmSubscription` 적용 |

- 쓰기 로그(`subscription.ts:82-86`)의 `alertMode` 항목은 `regionMode: input.regions.mode`, `sourceMode: input.sources.mode`로 바꾼다.
- `updateSourceFilter`만 실행된 옛 문서는 `{alertMode, regions[], sources{...}}`가 된다. 읽기 변환이 이 조합도 처리한다.

#### 저장 형식 예

```
users/{userId}/notifications/settings
{
  enabled: true,
  regions: { mode: "SELECTED", values: ["seoul", "busan"] },
  sources: { mode: "ALL", values: [] },
  createdAt: Timestamp,
  updatedAt: Timestamp
  // alertMode: 저장하지 않음 (쓸 때 FieldValue.delete())
}
```

- `userId`는 지금처럼 문서에 저장하지 않고 경로(`users/{userId}`)에서 얻는다(`subscription.ts:130`). 승인된 결정의 문서 모양에는 `userId`가 있으나, 현재 코드는 저장하지 않으므로 현행을 유지한다. (확인 필요 항목으로 보고)

#### 배포 조건

- **스케줄러(Functions)와 게이트웨이(Oracle VM)는 같은 커밋으로 함께 배포한다.** 두 프로세스가 같은 구독 문서를 읽고, 옛 코드는 새 형식 `regions`(객체)를 배열로 읽다가 오류가 난다.
- **첫 배포 뒤 스키마를 바꿀 때는 "읽는 쪽 먼저 배포" 원칙을 따른다.** 새 형식을 읽을 수 있는 코드를 두 프로세스에 먼저 배포하고, 새 형식으로 쓰는 코드는 그다음에 배포한다.

#### 남는 위험

- 이 브랜치에서 저장한 테스트 계정 문서를 dev 코드로 읽으면 오류가 난다.
  - 스케줄러: `filterByMode`가 `alertMode`가 없어 SELECTED로 판단하고 `filterByRegion(jobs, 객체)`를 호출한다. `regions.map`에서 TypeError가 나고, dev에는 구독자별 try/catch가 없어 그 회차의 나머지 구독자 발송도 멈춘다.
  - 게이트웨이: `subscribeRemove.ts:58` 등에서 `sub.regions`를 배열로 다루다 오류가 난다.
  - 대응: dev 브랜치로 돌아가기 전에 테스트 계정의 `users/{userId}/notifications/settings` 문서를 지우거나, 이 브랜치에서만 테스트 계정을 쓴다.

#### 에러 처리
- Store는 Firestore 예외를 그대로 던진다(현행 유지). 구독 서비스가 `SystemError.firestoreError`로 감싼다.
- 형식 오류 문서는 던지지 않고 기본값으로 읽은 뒤 `providerLogger.warn`으로 남긴다.

### 2.3 구독 서비스

**파일**: `features/alarmSubscribe/services/subscriptionService.ts`

호출하는 쪽(버튼 핸들러) 변경을 줄이기 위해 메서드 이름은 최대한 유지한다.

| 메서드 | 변경 |
|--------|------|
| `getUserAlertMode(userId)` | 이름 유지. `settings?.regions.mode ?? null` 반환 (`:30`) |
| `updateMode(userId, mode)` | `store.updateRegionMode(userId, mode)` (`:86`). 지역 목록은 남는다 |
| `updateRegions(userId, regions)` | `store.updateRegionFilter(userId, {mode:"SELECTED", values: regions})` (`:108`) |
| `updateSources(userId, filter)` | 신규. SELECTED이고 `values.length === 0`이면 `SystemError.validationError` 발생(저장 안 함). 그 외 `updateMode`·`updateRegions`처럼 `ensureExists(userId)`로 문서가 있는지 먼저 확인한 뒤 `store.updateSourceFilter`를 실행하고 재조회해 반환. `update()`는 문서가 없으면 NOT_FOUND 오류를 내기 때문이다 |
| `ensureExists` 기본값 | `{ enabled: true, regions: {mode:"ALL"}, sources: {mode:"ALL"} }` (`:193-197`) |
| `resubscribe` 주석 | "기존 `regions`/`sources` 보존"으로 수정 (`:156`) |

- 모드를 ALL로 바꿔도 지역 목록은 남는다. 다시 SELECTED로 돌아오면 이전 선택 지역이 복원된다. 지금 동작과 같다(§2.2 쓰기).

### 2.4 소스 표시 정보 (`SOURCE_CONFIGS`)

**파일**: `providers/recruit/index.ts`

```typescript
export interface SourceConfig {
  intervalMinutes: number;   // 기존 — 스케줄 주기
  displayName: string;       // 사용자에게 보이는 사이트 이름. RecruitDisplay.sourceLabel
  url?: string;              // "전체 공고" 링크. 없으면 링크 없이 텍스트만
  userFacing: boolean;       // 사이트 설정 화면 노출 + 발송 대상 여부
}

const SOURCE_CONFIGS: Record<RecruitSource, SourceConfig> = {
  sria: {
    intervalMinutes: sriaConfig.intervalMinutes,
    displayName: "sria",
    url: ENV.SRIA_URL,
    userFacing: true,
  },
  elias: {
    intervalMinutes: eliasConfig.intervalMinutes,
    displayName: "elias",
    url: undefined,
    userFacing: true,
  },
};

export function getSourceConfig(source: RecruitSource): SourceConfig;   // 반환 타입만 확장
export function getUserFacingSources(): RecruitSource[];               // userFacing === true인 소스
```

- `getSourceConfig`의 기존 호출(`app/scheduler.ts:33,45`, `schedulers/factory.ts:14`)은 `.intervalMinutes`만 읽으므로 반환 타입을 바꿔도 영향이 없다. 호출 위치는 `SCHEDULED_JOBS`로 옮긴다(§2.8.2).
- 갱신 주기: sria는 240분에서 120분으로 바꾼다(`sriaMockConfig.ts:16`). elias는 30분 그대로다. 사용자에게 가는 알림은 사이트와 상관없이 매일 06~20시 짝수 정시에 나간다(§2.8).

**`userFacing` 값** — sria와 elias 모두 `true`다.
- 두 소스 모두 사이트 설정 화면의 공고 묶음에 들어가고, 소스 필터가 ALL인 구독자는 두 소스 공고를 모두 받는다.
- 값을 바꾸는 환경변수는 만들지 않는다. 값은 코드에 고정한다.
- 지금은 숨긴 소스가 없다. 그래도 `userFacing` 설정, `getUserFacingSources()`, 숨긴 소스를 빼는 `filterVisibleSources()`(§2.7)는 나중에 소스를 숨길 때 쓸 수 있도록 그대로 둔다.
- 공고 조회 슬래시 커맨드도 노출 사이트만 보여 주고, `RecruitDisplay`를 자세히 모드로 그린다(§2.9.4). 값이 없는 칸은 표시하지 않으므로 elias 항목에 빈 칸이 생기지 않는다.

### 2.5 공통 표시 형식과 `toDisplay()`

**파일**: `common/types/recruit.d.ts`, `providers/recruit/index.ts`, 신규 `providers/recruit/sria/sriaDisplay.ts`, 신규 `providers/recruit/elias/eliasDisplay.ts`

```typescript
// common/types/recruit.d.ts
/** 모든 사이트 공고가 가진 공통 값 */
export interface RecruitBase {
  id: string;            // 공고 번호. "{source}:{사이트 안 번호}"
  title: string;
  source: RecruitSource; // "sria" | "elias"
  postedBy: string;      // 게시자. 업체 이름이나 사람 이름. 생성 때 정해지고 바뀌지 않는다
  postedAt?: string;     // 작성 시각 "MM.DD HH:mm". 사이트가 주는 경우만 채운다
}

export interface SriaRecruit extends RecruitBase {
  source: "sria";
  url: string;
  dayTxt: string;                       // 모집 기간. "YYYY.MM.DD ~ YYYY.MM.DD"
  dDay: Dday;
  recruitmentStatus: RecruitmentStatus;
}

export interface DisplayField {
  name: string;
  value: string;
}

export interface RecruitDisplay {
  source: RecruitSource;        // 소스별로 묶거나 "전체 공고" 링크(SourceConfig.url)를 찾을 때 쓴다
  sourceLabel: string;          // SourceConfig.displayName
  title: string;
  postedBy: string;             // 게시자
  url?: string;                 // 없으면 제목을 링크 없이 표시
  period?: string;              // 모집 기간. "YYYY.MM.DD"로 시작 (아래 기간 형식 규칙)
  status?: string;              // 모집 상태 (예: "접수중", "종료"). 두 모드 모두 제목의 지역 뒤에 [상태]로 그린다
  extraFields?: DisplayField[]; // 소스 고유 값
}
```

**`postedBy`** — 제목이 같아도 게시자가 다르면 다른 공고다. 제목으로 중복을 거르는 단계는 만들지 않는다.
- sria: `SriaSeed`(`sriaPostings.ts:9-14`)에 `postedBy`를 추가하고 8건 모두 값을 적는다. 생성기(`sriaMockGenerator.ts`)는 그대로 옮긴다.
- elias: 공고 목록 `eliasTitles`의 한 줄에 제목과 함께 적는다(§2.6).

**`postedAt`** — 작성 시각. 선택 값이라 사이트마다 필요할 때만 채운다(2026-10-27 사용자 결정).
- sria: `SriaSeed`에 `postedAt?: string`을 추가한다. 아는 공고만 값을 적고 모르면 비워 둔다. 생성기는 그대로 옮긴다.
- elias: 채우지 않는다. 모집 기간 시작이 곧 생성 시각이고 시각까지 표시되므로 같은 값이 두 번 나오게 된다.
- 화면에는 변환 함수가 `extraFields`의 "작성" 칸으로 넘긴다. 그래서 `RecruitDisplay`와 목록 그리기 코드는 바꾸지 않는다.
- 정렬에는 쓰지 않는다. 정렬 기준은 모집 시작 시점이다(§2.7).
- 비교값 계산에 들어가지만 한 번 정해지면 바뀌지 않으므로, 이 값 때문에 "바뀐 공고"가 되지 않는다.

**기간 형식 규칙** — 모든 사이트의 기간 값은 `YYYY.MM.DD`로 시작한다.
- 사이트가 어떤 형식으로 날짜를 주든, 공고를 만들 때(생성기 또는 수집 코드) 이 형식으로 바꿔 넣는다.
- 정렬은 앞의 시작 시점만 읽는다. 시각이 있으면 시각까지 비교한다(§2.7 `getStartDate`).
- 지금 값: sria `2026.09.06 ~ 2026.09.13`(이미 맞음), elias `2026.10.11 14:00 ~ 2026.10.12 02:00`(§2.6에서 연도 추가).

**소스별 변환** — 순수 함수. 표시 이름은 인자로 받는다(`index.ts`와 서로 import하는 순환을 피하기 위해).

```typescript
// sria/sriaDisplay.ts
export function sriaToDisplay(r: SriaRecruit, label: string): RecruitDisplay {
  return {
    source: "sria",
    sourceLabel: label,
    title: r.title,
    postedBy: r.postedBy,
    url: r.url || undefined,
    period: trimDate(r.dayTxt),           // notificationMessageEmbed.ts:38-41에서 옮겨 옴 (sria 형식 전용)
    status: r.recruitmentStatus,
    extraFields: [                         // 값이 있는 칸만 넣는다. 빈 배열이면 둘째 줄에 칸이 없다
      ...(r.postedAt ? [{ name: "작성", value: r.postedAt }] : []),
      ...(r.dDay ? [{ name: "마감", value: r.dDay }] : []),   // dDay는 ""일 수 있음 (recruit.d.ts:13)
    ],
  };
}

// elias/eliasDisplay.ts
export function eliasToDisplay(r: EliasRecruit, label: string): RecruitDisplay {
  return {
    source: "elias",
    sourceLabel: label,
    title: r.title,
    postedBy: r.postedBy,
    period: r.period,
    status: r.status,
    extraFields: r.fields,                 // eliasFields 규칙으로 만든 값만. 화면에는 "이름 값"으로 나온다
  };
}

// index.ts — 소스 판별 후 위임. 소스를 추가하면 default 분기에서 컴파일 오류가 나서 누락을 막는다.
export function toDisplay(recruit: Recruit): RecruitDisplay {
  const { displayName } = SOURCE_CONFIGS[recruit.source];
  switch (recruit.source) {
  case "sria": return sriaToDisplay(recruit, displayName);
  case "elias": return eliasToDisplay(recruit, displayName);
  default: {
    const unknownSource: never = recruit;
    throw SystemError.validationError("알 수 없는 공고 소스", { recruit: unknownSource });
  }
  }
}
```

- `trimDate`를 sria 변환으로 옮기는 이유: "시간 제거" 규칙은 sria `dayTxt` 형식에만 맞다. embed가 소스를 몰라도 되게 하려면 변환 쪽에 있어야 한다.

### 2.6 elias 공고 형식 정리

**파일**: `common/types/recruit.d.ts`, `providers/recruit/elias/eliasRule.ts`, `providers/recruit/elias/eliasMockConfig.ts`, `providers/recruit/elias/eliasTitles.ts`, `common/constants/city.ts`, `providers/recruit/elias/eliasFields.ts`, `providers/recruit/elias/README.md`

(이름 변경(§2.11) 뒤의 파일 이름으로 적는다. 줄 번호는 변경 전 `temp/` 파일 기준이다.)

```typescript
export interface EliasRecruit extends RecruitBase {
  source: "elias";
  period: string;            // 모집 기간. 실제 날짜·시각(한국 시간)으로 고정. 예: "2026.10.11 14:00 ~ 2026.10.12 02:00"
  status: RecruitmentStatus; // "접수중" → 조기 마감되면 "종료"
  fields?: DisplayField[];   // eliasFields 규칙으로 생성 때 한 번 정해짐
}
```

#### 생성 규칙 (2026-10-14 결정)

`eliasMockConfig.ts` 변경:

```diff
   intervalMinutes: 30,
   unitMs: 30 * 60_000,
-  lifespanTicks: 48,                         // 24시간
-  spawnProbs: { 1: 0.4, 2: 0.1, 3: 0.02 },
-  editProb: 0.3,                             // "급구" 표시
-  deleteProb: 0.1,                           // 공고 제거
+  lifespanTicks: 24,                         // 모집 기간 12시간
+  spawnProbs: { 1: 0.45, 2: 0.12, 3: 0.03 }, // 나머지 40%는 0개
+  closeProb: 0.1,                            // 접수중 → 종료 (수정)
+  deleteProb: 0.05,                          // 목록에서 제거
   titles: eliasTitles,
```

| 단계 | 규칙 |
|------|------|
| 생성 | 30분마다: 0개 40%, 1개 45%, 2개 12%, 3개 3% |
| 수정 | 생성 다음 실행부터 매 실행 10%로 "접수중" → "종료". 처음 걸린 뒤로는 계속 "종료" |
| 제거 | 생성 다음 실행부터 매 실행 5%로 목록에서 빠짐. 수정 확률과 따로 계산한다 |
| 삭제 | 모집 기간 12시간이 지나면 목록에서 빠짐 |

예상 현황 (시뮬레이션 2,000일, 2026-10-14):
- 하루 생성 약 37건, 목록 평균 11건(90% 구간 6~16건), 접수중 5.3건·종료 5.8건.
- 기간 전에 제거되는 공고 69%. 알림 1회(2시간)당 새 공고 평균 2.5건.
- 위 값은 공고 줄 수 제한이 없을 때 계산했다. 지금은 공고가 2줄이라 한 회차에 2건까지만 만들어져(아래 "공고 목록"), 하루 생성은 약 36건이 되고 나머지 값도 같은 비율(약 4%)로 줄어든다.
- 새 규칙을 넣은 생성기 초안을 실제 변경 감지 코드(`RecruitCacheService`)에 30분 간격 9,600회 연결해 확인했다. 기간 지난 공고 남음 0, 같은 회차 완전 중복 0, "종료" 외 변경 0, 같은 30분 안 다른 시각 결과 동일.

**같은 공고에서 값이 바뀌는지**

| 필드 | 바뀌는가 | 이유 |
|------|---------|------|
| `id`·`title`·`postedBy` | 안 바뀜 | 공고 ID를 씨앗으로 한 난수로 고른 줄의 값이다 |
| `period` | 안 바뀜 | 생성 시점과 마감 시점으로 계산한다. 실행 시각을 쓰지 않는다 |
| `status` | 한 번 바뀔 수 있음 | "접수중" → "종료" (조기 마감) |
| `fields` | 안 바뀜 | 공고 ID와 속성 이름으로 정한다 |

- 그래서 elias 공고가 "변경됨"이 되는 경우는 `status`가 "종료"로 바뀔 때뿐이다.
- 지금 코드는 `dDay`·`dayTxt`·`recruitmentStatus`가 실행 시각에 따라 바뀌어, 실행할 때마다 모든 elias 공고가 "변경됨"으로 판정된다(`tempRule.ts:114-117`). 이 문제가 없어진다.
- "종료"로 바뀐 공고도 바뀐 공고로 보고 알림을 보낸다(§2.8.1, 2026-10-27 사용자 결정). DM에서는 정렬로 목록 아래쪽에 간다(§2.7 ②).
- 상태 값은 기존 `RecruitmentStatus`를 그대로 쓴다. elias는 "접수중"·"종료" 두 값만 만든다. "마감임박" 같은 새 값은 만들지 않는다.

#### 공고 목록 — 지역·제목·게시자를 한 줄에 적기 (2026-10-31 결정)

```typescript
// eliasTitles.ts
export interface EliasTitle {
  region: CityEn;     // 고를 수 있는 지역만 허용. 오타는 컴파일 오류
  title: string;      // 지역 표시 없이 제목만
  postedBy: string;   // 게시자. 알바 이름은 게시자에 종속된다
}

export const eliasTitles: EliasTitle[] = [
  { region: "fairyKingdom", title: "어제 팔리지 않은 빵 판매", postedBy: "요정 왕국" },
  { region: "worldTreeOrder", title: "교단 가입시키기", postedBy: "세계수 교단" },
];
```

- 임시 데이터다. 게시자는 앞으로 지역별로 정하며, 지금은 지역 이름과 같게 적는다.
- 생성기 설정 타입 `EliasRuleConfig`(변경 전 `TempRuleConfig`)의 `titles`도 `EliasTitle[]`로 바꾼다. 게시자 목록과 `posters` 설정은 두지 않는다.
- 생성기가 `[${toKorean(region)}] ${title}` 형식으로 공고 제목을 만든다(예: `"[요정 왕국] 어제 팔리지 않은 빵 판매"`).
- 지역 필터(`common/utils/recruitFilter.ts:32-34`, 제목에 지역 이름이 들어 있는지 확인)는 바꾸지 않는다.
- 공고마다 한 줄을 공고 ID 난수로 고른다(`tempRule.ts:106-108`와 같은 방식).
- **같은 회차(같은 생성 시점) 안에서 같은 줄을 쓰지 않는다.** 이미 고른 줄이면 다음 줄로 넘긴다. 목록의 줄을 다 썼으면 그 회차의 나머지 공고는 만들지 않는다. 그래서 지금은 3건이 뽑힌 회차도 2건만 만들어진다.
- 기간이 생성 시점으로 정해지므로, 다른 회차 공고는 기간이 달라 겹치지 않는다.

#### elias 지역 (2026-10-31 결정)

`common/constants/city.ts`에 권역을 추가한다. 지역 필터는 구독 지역 이름이 공고 제목에 있는지 확인하므로, 이 목록에 없으면 지역을 선택한 구독자가 elias 공고를 받을 수 없다.

```typescript
const EliasRegions = {
  fairyKingdom: "요정 왕국",
  worldTreeOrder: "세계수 교단",
} as const;

// CITIES에 ...EliasRegions 추가
// CITY_GROUPS에 추가
eliasRegions: { label: "elias 지역", itemPrompt: "지역을 선택하세요", cities: EliasRegions },
```

- `CityEn`, `toKorean`, 지역 선택 메뉴는 이 목록을 읽으므로 코드를 고치지 않는다. `regionSelectMenus.ts:9-10` 주석의 "75개 시"는 77개로, "권역(10)"은 11로 고친다.
- 공고 조회는 지역을 직접 입력받아 `isValidCityName`으로 검증한다(`events/listeners/commands/onRecruitRequest.ts:14-18`). 지금 정규식 `/^[가-힣]+$/`(`common/utils/cityName.ts:62`)은 공백을 허용하지 않아 `요정 왕국`이 없는 지역으로 처리된다. `/^[가-힣 ]+$/`로 고친다.
- 실제 지역만 고른 구독자는 elias 공고를 받지 않는다. `elias 지역`을 고르거나 모든 지역을 구독해야 받는다.

#### README 안내

`README.md`에는 속성별로 무엇을 넣는지만 짧게 적는다. 한글로 쓰라는 강제는 하지 않는다.

| 목록 | 속성 | 넣는 값 |
|------|------|--------|
| `eliasTitles` | `region` | 지역 값 (fairyKingdom, worldTreeOrder 등. `common/constants/city.ts`의 영문 지역 키) |
| `eliasTitles` | `title` | 지역을 뺀 공고 제목 |
| `eliasTitles` | `postedBy` | 게시자 이름 |
| `eliasFields` | `key` | 화면에 보일 이름 (예: 급여) |
| `eliasFields` | `value` | 그 값 (예: 시급 협의) |

- 제목 한 줄 예시는 `{ region, title, postedBy }` 한 줄로 바꾼다.
- `eliasFields` 예시의 `badge`("급구"·"우대")는 지우고 `{ key: "급여", required: true, value: { kind: "fixed", value: "시급 협의" } }` 같은 예로 바꾼다. `eliasFields.ts:7-9` 주석 예시도 같이 바꾼다.
- "자동으로 채워짐" 목록에서 마감(D-day)을 빼고 "모집 기간·상태(접수중, 조기 마감되면 종료)"로 적는다.
- 설정 표에서 `editProb` 줄을 지운다. `closeProb`는 "접수중이 종료로 바뀌는 확률. 종료된 공고는 모집 기간이 끝날 때까지 목록에 남는다", `deleteProb`는 "공고가 목록에서 빠지는 확률"로 적는다. 두 확률은 따로 계산된다고 적는다.
- 모집 기간을 12시간으로, 생성 확률을 위 표 값으로 바꿔 적는다.

#### 생성부

`tempRule.ts:93-130` 생성부 변경:

```typescript
for (let s = Math.max(0, t - lifespan); s <= t; s++) {
  const n = spawnCount(s, cfg.spawnProbs);
  const used = new Set<number>();   // 이 회차에서 고른 줄

  for (let idx = 0; idx < n; idx++) {
    const id = `elias:${s}-${idx}`;

    // ⚠️ 줄 선택은 제거·만료 판정보다 먼저 한다.
    //    판정 뒤에 고르면, 앞 공고가 제거된 회차부터 뒤 공고의 줄이 바뀌어
    //    "변경됨"으로 잡힌다 (2026-10-14 초안 검증에서 9,600회 중 29건 발생).
    if (used.size >= cfg.titles.length) break;   // 줄을 다 썼으면 이 회차는 더 만들지 않는다
    let titleIdx = Math.floor(rand(id, "title") * cfg.titles.length);
    while (used.has(titleIdx)) titleIdx = (titleIdx + 1) % cfg.titles.length;
    used.add(titleIdx);

    // 모집 기간 끝: 목록에서 빠진다.
    if (t >= s + lifespan) continue;
    // 제거: 처음 걸린 시점부터 목록에서 빠진다.
    const removedAt = firstHitTick(id, "del", s, lifespan, cfg.deleteProb);
    if (removedAt !== null && t >= removedAt) continue;
    // 종료: 처음 걸린 시점부터 모집 기간 끝까지 "종료"로 남는다.
    const closedAt = firstHitTick(id, "close", s, lifespan, cfg.closeProb);
    const status: RecruitmentStatus = closedAt !== null && t >= closedAt ? "종료" : "접수중";

    const pick = cfg.titles[titleIdx];
    const title = `[${toKorean(pick.region)}] ${pick.title}`;
    const postedBy = pick.postedBy;

    // 사용자 정의 속성(eliasFields)
    const fields: DisplayField[] = [];
    for (const f of cfg.fields) {
      const include = f.required || rand(id, "field", f.key) < (f.chance ?? 0);
      if (!include) continue;
      const v = resolveValue(f.value, id, f.key);
      if (v !== undefined) fields.push({ name: f.key, value: String(v) });
    }
    out.push({
      id, source: "elias", title, postedBy,
      period: `${formatKst(s * cfg.unitMs)} ~ ${formatKst((s + lifespan) * cfg.unitMs)}`,
      status,
      ...(fields.length ? { fields } : {}),
    });
  }
}
```

```typescript
const KST_OFFSET_MS = 9 * 60 * 60_000;

/** epoch ms → "YYYY.MM.DD HH:mm" (한국 시간). 서버 시간대와 상관없이 같은 글자를 만든다. */
function formatKst(ms: number): string {
  const d = new Date(ms + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
```

- 한국 시간을 `getUTC*` + 9시간으로 계산하는 이유: 배포된 함수는 UTC, 로컬은 한국 시간으로 돌아서 `getHours()`를 쓰면 같은 공고의 기간 글자가 환경마다 달라진다. 기존 `common/utils/formatDate.ts`는 실행 환경 시간대를 쓰므로 재사용하지 않는다.
- `firstDeathTick`(`tempRule.ts:62-76`)은 난수 이름(`"del"`·`"close"`)을 인자로 받는 `firstHitTick`으로 바꿔 제거와 종료에 함께 쓴다. 계산은 그대로다(생성 다음 칸부터 모집 기간 안에서 처음 확률에 걸린 시점). 난수 이름이 달라서 두 확률은 서로 영향을 주지 않는다.
- `EliasRuleConfig`에 `closeProb: number`를 추가한다.
- 확률 수정(`rand(id, "edit", t) < cfg.editProb` → `badge = "급구"`, `tempRule.ts:121-124`)은 없앤다. `EliasRuleConfig.editProb`(`tempRule.ts:18-19`)와 `eliasConfig.editProb`(`tempMockConfig.ts:19`)도 지운다.
- `dDay`·`recruitmentStatus`·`url`·`dayTxt`와 인덱스 시그니처(`[key: string]: unknown`)를 없앤다. `age`·`remaining` 변수는 더 이상 쓰지 않으므로 지운다.
- `EliasRuleConfig`의 `unitMs`·`lifespanTicks` 주석에 쓰인 "틱"은 코드 안 설명이라 그대로 둔다. 사용자에게 보이는 글자(`period`)에는 들어가지 않는다.
- 공고 ID 앞부분이 `elias:`로 바뀌므로(§2.11) 첫 elias 갱신에는 비교 기준이 없다. 그 회차는 기준만 저장한다(`recruitCacheService.ts:77-83`). 배포 후 첫 알림도 "지난 알림 때 목록"이 없어 저장만 하므로(§2.8.2) 몰아서 발송되는 일은 없다.

### 2.7 필터

**파일**: `common/utils/recruitFilter.ts`

세 필터는 서로를 모른다. 모두 `Job[]`을 받아 걸러진 `Job[]`을 돌려준다. `common`은 `providers`를 import하지 않으므로, 노출 소스 목록은 인자로 받는다.

```typescript
/** ① 숨긴 소스 제외. 발송 1회에 한 번만 호출한다. */
export function filterVisibleSources(jobs: Job[], visible: ReadonlySet<RecruitSource>): Job[] {
  return jobs.filter((job) => visible.has(job.value.source));
}

/** ③ 소스 필터. ALL이면 그대로. 판정 기준은 job.value.source (common/types/job.d.ts:7). */
export function filterBySource(jobs: Job[], filter: AlarmFilter<RecruitSource>): Job[] {
  if (filter.mode === AlertMode.ALL) return jobs;
  const wanted = new Set(filter.values);
  return jobs.filter((job) => wanted.has(job.value.source));
}

/** ④ 지역 필터. ALL이면 그대로. SELECTED면 기존 제목 포함 규칙(지역 0개면 빈 배열). */
export function filterByRegion(jobs: Job[], filter: AlarmFilter<CityEn>): Job[] {
  if (filter.mode === AlertMode.ALL) return jobs;
  return matchRegions(jobs, filter.values);   // 기존 filterByRegion 본문(:25-35)을 내부 함수로
}

/** 공고의 시작 시점 "YYYY.MM.DD" 또는 "YYYY.MM.DD HH:mm". 형식이 맞지 않으면 "" (맨 뒤로 감). */
export function getStartDate(recruit: Recruit): string {
  const period = (() => {
    switch (recruit.source) {
    case "sria": return recruit.dayTxt;
    case "elias": return recruit.period;
    default: {
      const unknownSource: never = recruit;   // 소스를 추가하면 여기서 컴파일 오류
      return unknownSource;
    }
    }
  })();
  return /^\d{4}\.\d{2}\.\d{2}(?: \d{2}:\d{2})?/.exec(period)?.[0] ?? "";
}

/** 시작 시점 최신순. 시점이 같으면 원래 순서를 유지한다(Array.prototype.sort는 안정 정렬). */
export function sortByStartDateDesc<T>(items: T[], toRecruit: (item: T) => Recruit): T[] {
  return [...items].sort((a, b) => getStartDate(toRecruit(b)).localeCompare(getStartDate(toRecruit(a))));
}

/** 공고의 모집 상태. 소스마다 상태 필드 이름이 달라 여기서 한 번에 읽는다. */
export function getRecruitStatus(recruit: Recruit): RecruitmentStatus {
  switch (recruit.source) {
  case "sria": return recruit.recruitmentStatus;
  case "elias": return recruit.status;
  default: {
    const unknownSource: never = recruit;   // 소스를 추가하면 여기서 컴파일 오류
    return unknownSource;
  }
  }
}

/** 알림 정렬의 상태 순서. 작을수록 앞에 온다. */
const STATUS_ORDER: Record<RecruitmentStatus, number> = { 접수중: 0, 발표중: 1, 종료: 2 };

/** ② 알림 정렬. 접수중 → 발표중 → 종료, 같은 상태 안에서는 시작 시점 최신순. 발송 1회에 한 번만 호출한다. */
export function sortForNotification(jobs: Job[]): Job[] {
  return sortByStartDateDesc(jobs, (job) => job.value).sort(
    (a, b) => STATUS_ORDER[getRecruitStatus(a.value)] - STATUS_ORDER[getRecruitStatus(b.value)],
  );
}
```

- `getStartDate`는 시각이 있으면 `YYYY.MM.DD HH:mm`까지 읽는다. 이 글자는 사전순이 시간순과 같으므로 날짜로 바꾸지 않고 글자로 비교한다.
- 시각까지 비교하는 이유: elias 공고는 모집 기간이 12시간이라 날짜만 보면 같은 날 공고가 모두 같은 순서가 되어 새 공고가 위로 오지 못한다(2026-11-03 사용자 결정. 10-14의 "날짜만 비교"를 대체). 시작 시점이 같으면 생성기가 준 순서를 따른다.
- 알림 정렬은 최신순으로 먼저 정렬한 뒤 상태로 다시 정렬한다. `Array.prototype.sort`는 안정 정렬이라 같은 상태 안에서는 최신순이 유지된다(2026-10-27 사용자 결정). 예: A(접수중, 10.11)·B(종료, 10.12)·C(접수중, 10.09)·D(발표중, 10.10) → A, C, D, B.
- "종료" 공고도 빼지 않고 뒤에 둔다. 공고는 남아 있지만 모두 마감된 경우에도 목록을 보여 주기 위해서다(2026-10-27 사용자 결정. 10-12의 "종료" 공고 알림 제외를 대체).
- 발송은 ①에서 숨긴 소스를 뺀 뒤 ②에서 한 번 정렬한다. ③·④는 `filter`라서 순서가 유지된다.
- 공고 조회 커맨드는 상태와 상관없이 최신순으로만 정렬한다(`sortByStartDateDesc(list, (r) => r)`, §2.9.4).
- `filterByMode`(`:47-51`)는 삭제한다. 사용처는 `notificationService.ts:5,33` 하나다.
- 숨긴 소스는 SELECTED 구독자가 골랐더라도 ①에서 이미 빠지므로 보내지 않는다.
- 상태를 읽는 함수를 `common/utils/recruitFilter.ts`에 두는 이유: 상태 필드는 `common/types/recruit.d.ts`의 공고 타입에 있으므로 `providers`를 import하지 않고 읽을 수 있다. 다른 필터와 같은 파일에 두면 발송 판정 단계가 한 파일에 모인다.
- `RecruitDisplay.status`로 정렬하지 않는 이유: 변환(⑤)은 구독자마다 실행된다. ②는 그 전에 한 번만 정렬해야 한다.

### 2.8 발송

**파일**: `services/notificationService.ts`, `app/scheduler.ts`, 신규 `schedulers/jobs.ts`, `schedulers/**`(§2.8.2 스케줄 등록), `services/recruitService.ts`, 신규 `providers/redis/store/notifiedHashStore.ts`, 신규 `common/utils/recruitHash.ts`, `providers/redis/manager/redisManager.ts`, `providers/redis/key/recruitKeyManager.ts`, `events/bus/handlers/NotificationEventHandler.ts`, `events/bus/utils/registerEventHandlers.ts`, `events/bus/types.ts`, `events/bus/handlers/NotificationSendHandler.ts`

사이트 갱신 주기와 상관없이, 알림 스케줄러가 매일 06~20시 짝수 정시에 사용자별 DM 한 통을 보낸다(2026-10-14·2026-10-31 사용자 결정). 구독 조건에 맞는 공고 중 바뀐 공고가 있으면, 바뀌지 않은 공고까지 포함한 목록 전체를 보낸다(2026-10-27 사용자 결정).

#### 2.8.0 서비스 객체를 만드는 시점 (2026-11-01 사용자 결정)

`notificationService`는 파일을 불러올 때 만들어진다(`notificationService.ts:48`). 여기에 Redis를 쓰는 필드를 넣으면 Redis 초기화 전에 `RedisManager.getInstance()`가 불려 예외가 난다(`redisManager.ts:55-59`). 그래서 처음 쓸 때 만들고, 필요한 객체는 생성자로 받는다. 테스트는 이 생성자로 가짜 저장소를 넘긴다.

```typescript
// services/notificationService.ts
interface NotificationDeps {
  redis: Pick<RedisManager, "acquireLock" | "releaseLock">;
  recruitService: RecruitService;
  recruitCache: RecruitCacheService;
  notifiedStore: NotifiedHashStore;
  recruitStore: RecruitStore;
  subscriptionStore: SubscriptionStore;
}

export class NotificationService {
  constructor(private readonly deps: NotificationDeps) {}
}

let instance: NotificationService | undefined;

/** 처음 부를 때 만든다. Redis 초기화(`ready()`) 뒤에만 부른다. */
export function getNotificationService(): NotificationService {
  return (instance ??= new NotificationService(createNotificationDeps()));
}
```

- `export const notificationService`를 지운다. 이 값을 쓰던 곳은 지우기로 한 `NotificationEventHandler.ts`뿐이다(§2.8.2).
- `createNotificationDeps()`는 `notificationService.ts`에 둔다. `RedisManager.getInstance()`와 그 `store`, `new RecruitService()`, `new RecruitCacheService(...)`, `new RecruitStore()`, `new SubscriptionStore()`로 `NotificationDeps`를 채운다.
- `notifiedStore`는 `RedisManager.store`에 등록해 기존 저장소처럼 꺼내 쓴다(`redisManager.ts:16,24`의 등록 지점).
- `RecruitService`도 생성자로 받는다. **넘기지 않은 항목만 만든다.** 그래서 가짜 객체를 모두 넘긴 테스트에서는 `RedisManager.getInstance()`와 `new RecruitStore()`가 불리지 않는다.

```typescript
// services/recruitService.ts
interface RecruitServiceDeps {
  redis: Pick<RedisManager, "acquireLock" | "releaseLock" | "getValue" | "setValue">;
  cacheService: RecruitCacheService;
  firestore: RecruitStore;
  recruitSource: RecruitSourceService;
  lockWaitMs: number;   // 사이트 락을 기다리는 최대 시간. 기본 60초, 테스트만 10초
}

constructor(deps: Partial<RecruitServiceDeps> = {}) {
  this.redis = deps.redis ?? RedisManager.getInstance();
  this.cacheService = deps.cacheService ?? createDefaultCacheService();   // 지금 생성자의 store 읽기를 옮긴 함수
  this.firestore = deps.firestore ?? new RecruitStore();
  this.recruitSource = deps.recruitSource ?? new RecruitSourceService();
  this.lockWaitMs = deps.lockWaitMs ?? 60_000;
}
```

- `syncRecruits`의 락과 마지막 갱신 시각은 `this.redis`를 쓴다. 기존 호출 `onRecruitRequest.ts:39`, `test/routes.ts:16`은 `new RecruitService()` 그대로다.
- `SCHEDULED_JOBS`의 `run`은 실행될 때만 불리므로, 파일을 불러오거나 스케줄러를 등록하는 단계에서는 Redis를 건드리지 않는다.

#### 2.8.1 판정·발송 (`notifyRecruits`)

알림 스케줄러(§2.8.2)가 넘긴 최신 공고 목록과 바뀐 공고 ID를 받아 구독자별로 거르고 보낸다. 기존 `notifyNewRecruits(payload)`를 `notifyRecruits(current, changedIds)`로 바꾼다.

```typescript
async notifyRecruits(current: Job[], changedIds: ReadonlySet<string>): Promise<number> {
  if (changedIds.size === 0) return 0;
  // ① 숨긴 소스 제외, ② 접수중 → 발표중 → 종료 + 같은 상태 안 최신순 정렬 (모두 한 번만)
  const targetJobs = sortForNotification(
    filterVisibleSources(current, new Set(getUserFacingSources())),
  );
  if (targetJobs.length === 0) return 0;

  const subscribers = await this.deps.subscriptionStore.getAllActiveSubscribers();
  let sent = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    // 구독자 한 명의 오류가 나머지 발송을 막지 않는다
    try {
      // ③ 공고 묶음 저장값을 소스 목록으로 펼친다 (§2.9.5)
      const bySource = filterBySource(targetJobs, expandSourceFilter(subscriber.sources));
      const matched = filterByRegion(bySource, subscriber.regions);       // ④
      // 구독 조건에 맞는 공고 중 바뀐 것이 없으면 보내지 않는다
      if (!matched.some((job) => changedIds.has(job.id))) continue;

      const displays = matched.map((job) => toDisplay(job.value));       // ⑤ 바뀌지 않은 공고도 함께
      await eventBus.emitEventAndSettle<NotificationSendEvent>(EventType.NOTIFICATION_SEND, {
        timestamp: Date.now(),
        source: "NotificationService",
        userId: subscriber.userId,
        displays,
        settings: subscriber,
      });
      sent++;
    } catch (error) {
      failed++;
      globalLogger.error("구독자 알림 처리 실패 — 다음 구독자로 진행", error as Error, {
        userId: subscriber.userId,
      });
    }
  }
  if (failed > 0) {
    globalLogger.warn(`알림 처리 실패 ${failed}/${subscribers.length}명`);
  }
  return sent;
}
```

- 바뀐 공고는 새로 생긴 공고, 내용이 바뀐 공고, 마감으로 바뀐 공고다. 마감 소식도 알림으로 받을 만한 정보이고, 받는 목록은 접수 중 공고가 위에 정렬되어 있기 때문이다(2026-10-27 사용자 결정). 사라진 공고는 최신 공고 목록에 없으므로 DM을 일으키지 않는다.
- 구독자마다 판정한다. 바뀐 공고가 다른 지역·사이트에만 있으면 그 구독자에게는 보내지 않는다.
- 구독자 한 명의 발송이 실패해도(DM 발송 함수가 3번 다시 시도한 뒤) 지난 알림 때 목록은 저장한다. 실패한 구독자를 따로 저장하지 않는다. 그 구독자는 다음에 DM을 받을 때 아직 남아 있는 공고를 함께 받는다(2026-10-27 사용자 결정). 실패는 로그로 남기고, 잦아지면 다시 검토한다.
- `failed`는 필터·변환·이벤트 발행에서 난 오류만 센다. DM 발송 실패는 `NotificationSendHandler`가 삼키고 자체 로그로 남기므로(`NotificationSendHandler.ts:47-53`) 여기 집계되지 않는다.
- `getAllActiveSubscribers()` 자체가 실패하면 예외가 위로 전달된다(구독자 목록이 없으면 발송할 수 없음). 이때 "지난 알림 때 목록"은 저장하지 않으므로 다음 알림에서 다시 시도된다.
- `getUserFacingSources()`는 `providers/recruit`에서 import한다(services → providers 허용 방향).

#### 2.8.2 알림 스케줄러 (`runNotification`)

```typescript
// services/notificationService.ts
/** @returns 발송을 시도한 구독자 수. DM이 실패해도 센다. 건너뛰거나 저장만 했으면 0 */
async runNotification(): Promise<number> {
  const { redis } = this.deps;
  // 0. 알림 락: 같은 알림이 두 번 실행되면 뒤 실행은 바로 끝낸다
  const token = await redis.acquireLock(NOTIFICATION_LOCK_KEY, 5 * 60_000);
  if (!token) {
    globalLogger.warn("알림이 이미 실행 중 — 이번 실행은 건너뜀");
    return 0;
  }
  try {
    // 1. 사이트마다 동시에 강제 갱신 (최근 5분 안에 갱신했으면 건너뜀, 진행 중이면 끝날 때까지 기다림)
    const syncResults = await Promise.allSettled(
      getAllProviders().map(({ source }) =>
        this.deps.recruitService.syncRecruits(source, { skipIfSyncedWithinMs: 5 * 60_000, waitForLock: true })),
    );
    const anySyncFailed = syncResults.some((r) => r.status === "rejected");

    // 2. 최신 공고 목록 ↔ 지난 알림 때 목록 비교
    const current = (await this.deps.recruitCache.getRecruitList()) ?? [];
    if (current.length === 0 && anySyncFailed) {
      // 갱신 실패로 목록이 빈 경우: 비교 기준과 Firestore 목록을 지키려고 아무것도 저장하지 않는다
      globalLogger.warn("사이트 갱신 실패로 최신 공고 목록이 비어 있음 — 저장 없이 끝냄");
      return 0;
    }
    const currentHashes = hashRecruits(current);              // 공고 ID → 비교값
    const notified = await this.deps.notifiedStore.getAll();      // 없으면 null
    if (!notified) {
      // 처음이거나 키를 지운 경우: 저장만 하고 보내지 않는다 (이미 받은 공고 재발송 방지)
      await this.deps.notifiedStore.clearAndSaveHashes(currentHashes);
      await this.backupToFirestore(current);
      globalLogger.warn("지난 알림 때 목록 없음 — 저장만 하고 발송하지 않음");
      return 0;
    }
    // 새 공고 + 내용이 바뀐 공고(마감으로 바뀐 공고 포함)
    const changedIds = new Set(
      current.filter((r) => notified[r.id] !== currentHashes[r.id]).map((r) => r.id),
    );

    // 3. 판정·발송 (§2.8.1). 바뀐 공고가 있는 구독자에게 구독 조건에 맞는 공고 전체를 보낸다
    const sent = await this.notifyRecruits(current.map((r) => ({ id: r.id, value: r })), changedIds);

    // 4. 발송이 끝난 뒤 저장. 지금 목록에 없는 ID는 이때 빠진다
    await this.deps.notifiedStore.clearAndSaveHashes(currentHashes);

    // 5. Firestore 공고 목록도 최신으로 저장 (Redis가 비었을 때 공고 조회가 읽는 목록)
    await this.backupToFirestore(current);
    return sent;
  } finally {
    await redis.releaseLock(NOTIFICATION_LOCK_KEY, token);
  }
}

/** Firestore 공고 목록 저장. 실패해도 알림은 성공으로 끝낸다(다음 알림에서 다시 저장). */
private async backupToFirestore(current: Recruit[]): Promise<void> {
  try {
    await this.deps.recruitStore.saveRecruitList(current);
  } catch (error) {
    globalLogger.error("Firestore 공고 목록 저장 실패 — 다음 알림에서 다시 저장", error as Error);
  }
}
```

**Firestore 공고 목록 저장** (2026-10-27 사용자 결정)
- 지금은 예약 실행되는 사이트 갱신이 Firestore에 갱신 시각만 저장한다(`recruitService.ts:113`). 공고 목록은 공고 조회 커맨드가 사이트에서 직접 가져올 때만 저장되어 오래된 상태로 남는다.
- Phase 1.10에서 "시간 기준으로 주기 저장"하는 개선안을 후순위로 정해 두었다(`docs/archive/phase-1-10/04-report.md:216`). 이번에 알림 스케줄러에서 처리한다.
- 알림에서 저장하는 이유: 알림은 모든 사이트를 갱신한 뒤의 목록을 이미 읽고 있다. 정해진 시각마다 돌므로 그 자체가 시간 기준 저장이 되어, 마지막 저장 시각을 비교할 값이 따로 필요 없다. 사이트 갱신에서 저장하면 사이트마다 따로 돌아 저장이 겹친다.
- `RecruitStore.saveRecruitList`(`providers/firebase/store/recruit.ts:45-50`)를 그대로 쓴다. 문서 전체를 바꾸고 `lastRefreshedAt`도 함께 적는다.
- 처음 실행(지난 알림 때 목록 없음)에도 저장한다. 하루 8번 쓰기라 Firestore 무료 사용량에 영향이 없다.
- 공고 조회 커맨드를 읽기만 하게 바꾸는 결정(리뷰 문서 9번)과 묶인다. 그 경로를 없애면 Firestore 목록을 저장하는 곳이 이 단계뿐이다.

**목록이 비었을 때** (2026-10-31 사용자 결정)

| 상황 | 처리 |
|------|------|
| 모든 사이트가 정상 응답했고 0건 | 지난 알림 때 목록과 Firestore 공고 목록을 모두 비운다 |
| 갱신에 실패한 사이트가 있고(대기 초과 포함) 최신 공고 목록이 비어 있음 | 경고 로그만 남기고 둘 다 저장하지 않는다. 그대로 저장하면 비교 기준과 공고 조회가 마지막에 읽는 목록이 사라진다 |
| 갱신에 실패한 사이트가 있지만 최신 공고 목록에 공고가 있음 | 평소대로 진행한다 |

- 모든 사이트 갱신이 6시간 넘게 멈춘 뒤 일부 사이트만 복구되면, 복구되지 않은 사이트 공고는 최신 공고 목록에 없어 지난 알림 때 목록과 Firestore에서도 빠진다. 그 사이트가 복구되면 공고가 전부 바뀐 공고가 되어 DM이 한 번 더 나간다. 공고를 놓치지 않고 발생도 드물어 그대로 둔다(2026-11-01 사용자 결정).

- Redis 해시는 항목이 없으면 키도 사라져 "목록 없음"과 구분되지 않는다. 그대로 두면 0건 다음 알림이 첫 실행으로 처리되어 새 공고를 보내지 않는다. `clearAndSaveHashes`는 빈 목록을 저장할 때 표시 항목 `__empty__`를 넣고, `getAll`은 `hGetAll` 결과가 비어 있으면 먼저 `null`을 돌려주고(키 없음), 아니면 이 항목을 빼고 돌려준다. 순서가 바뀌면 빈 목록도 첫 실행으로 처리된다.

**Redis 저장 메서드**

| 메서드 | 위치 | 동작 |
|--------|------|------|
| `getAll(): Promise<Record<string, string> \| null>` | `providers/redis/store/notifiedHashStore.ts` (신규) | `recruit:notified:all`을 읽는다. 키가 없으면 `null`, 빈 목록이면 `{}` |
| `clearAndSaveHashes(hashes): Promise<void>` | 같은 파일 | `multi()`로 지우기와 저장을 한 번에 실행한다. `hashes`가 비면 `__empty__` 항목을 저장한다 |
| `getValue(key)` | `RedisManager` (기존) | `recruit:lastSync:{source}`를 읽는다. `syncRecruits`가 부른다 |
| `setValue(key, value, ttlMs)` | `RedisManager` (신규) | 만료 시간을 붙여 덮어쓴다. `syncRecruits`가 갱신 성공 시각을 1일 만료로 저장한다 |

키 이름은 `recruitKeyManager.ts`에 함수로 추가한다.

**스케줄 등록 — 작업 목록 한 곳** (2026-10-27 사용자 결정)

지금은 예약 실행할 작업이 세 곳에 따로 적혀 있다: 운영 함수(`app/scheduler.ts:31-52`), 로컬 1회 실행(`:55-62`), 로컬 계속 실행(`schedulers/utils/initializeSchedulers.ts:7`). 알림을 한 곳에서 빠뜨리면 오류 없이 DM만 나가지 않는다. 작업 목록을 한 곳에 두고 세 실행 방식이 모두 이 목록을 읽게 한다.

```typescript
// schedulers/jobs.ts (신규) — 예약 실행할 작업은 여기에만 적는다
export interface ScheduledJob {
  functionName: string;      // 배포되는 함수 이름. 바꾸면 기존 예약 실행 함수가 지워지고 새로 만들어진다
  intervalMinutes: number;   // 로컬 계속 실행의 반복 주기. schedule이 없으면 운영 일정도 이 값으로 만든다
  schedule?: string;         // 운영 일정을 직접 적을 때 쓴다 (cron 표현)
  timeoutSeconds: number;
  run: () => Promise<number>;   // 처리 건수. RECRUIT_SYNC_COMPLETED의 totalCount가 된다
}

const syncSource = (source: RecruitSource) => async () => {
  const { addedJobs, updatedJobs } = await new RecruitService().syncRecruits(source);
  return addedJobs.length + updatedJobs.length;
};

export const SCHEDULED_JOBS: ScheduledJob[] = [
  { functionName: "recruitSchedule_sria",  intervalMinutes: getSourceConfig("sria").intervalMinutes,  timeoutSeconds: 120, run: syncSource("sria") },
  { functionName: "recruitSchedule_elias", intervalMinutes: getSourceConfig("elias").intervalMinutes, timeoutSeconds: 120, run: syncSource("elias") },
  { functionName: "notificationScheduler", intervalMinutes: NOTIFICATION_INTERVAL_MINUTES, schedule: NOTIFICATION_SCHEDULE, timeoutSeconds: 300, run: () => getNotificationService().runNotification() },
];
```

| 실행 방식 | 바뀐 뒤 |
|-----------|--------|
| 운영 (`app/scheduler.ts`) | 목록을 돌며 작업마다 `onSchedule({ schedule: job.schedule ?? toScheduleExpression(job.intervalMinutes), timeZone: "Asia/Seoul", timeoutSeconds, secrets: FUNCTION_SECRETS }, …)`를 만들어 `exports[functionName]`으로 내보낸다. 핸들러는 `await ready()` 뒤 작업 스케줄러의 `runOnce()`를 부른다 |
| 로컬 1회 실행 (`RUN_SCHEDULER_ONCE=true`) | 목록 순서대로 작업 스케줄러의 `runOnce()`를 한 번씩 부른다. 사이트 갱신 다음에 알림이 돈다. 한 작업이 실패해도 다음 작업으로 간다 |
| 로컬 계속 실행 (`initializeSchedulers`) | `registerSchedulers()`가 목록을 돌며 작업마다 `BaseScheduler`를 등록하고, `initializeSchedulers()`는 등록 뒤 시작한다. `RecruitScheduler`는 받은 `run`을 실행하고 돌려받은 건수를 `totalCount`로 넘기는 범용 스케줄러로 바꾼다. `createRecruitScheduler(source)`는 `createScheduler(job: ScheduledJob)`으로 바꾸고, 스케줄러 이름은 `job.functionName`을 쓴다. 알림용 스케줄러 클래스는 따로 만들지 않는다. 이 경로는 cron 일정을 읽지 않고 `intervalMinutes`로만 돌며 시작 즉시 한 번 실행하므로, 22~04시 미발송을 지키지 않는다 |

- 운영은 지금처럼 `runOnce()`를 부른다(2026-11-01 사용자 결정). `runOnce()`는 예외를 삼키고 `RECRUIT_SYNC_*` 이벤트를 발행한다(`BaseScheduler.ts:49-118`). 이 이벤트는 모니터링 작업에서 쓸 값이다. 알림 작업도 같은 이벤트를 발행하며, 어느 작업인지는 스케줄러 이름(`functionName`)으로 구분한다. 알림의 `totalCount`는 발송을 시도한 구독자 수이며, DM이 실패해도 센다.
- `ready`는 파일을 불러올 때 시작하지 않고 처음 부를 때 시작하는 함수로 바꾼다(`const ready = () => (readyPromise ??= init())`). 파일을 불러오는 것만으로 Firebase·Redis 연결이 시작되지 않아, 내보낸 이름을 테스트로 확인할 수 있다.
- 운영 방식은 그대로 Cloud Scheduler가 `onSchedule` 함수를 실행하는 것이다. 계속 실행 경로는 Phase 1.10에서 고르지 않은 "단일 상시 프로세스" 안(`docs/archive/phase-1-10/07-deploy-architecture-decision.md:17`)을 위한 대안으로 남는다.
- 알림 주기 120분은 `NOTIFICATION_INTERVAL_MINUTES`, 운영 일정은 `NOTIFICATION_SCHEDULE = "0 6-20/2 * * *"`로 `services/notificationService.ts`에 둔다. 매일 06·08·…·20시에 하루 8번 실행한다. 22시부터 04시까지는 보내지 않고, 그사이 바뀐 공고는 06시 알림이 한 번에 보낸다(2026-10-31 사용자 결정).
- 사이트 갱신은 밤에도 계속한다. 공고 조회가 최신 목록을 읽어야 하고, 최신 공고 목록의 6시간 만료도 갱신이 연장하기 때문이다.
- 실행 제한 시간은 알림 300초(알림 락 5분과 같게), 사이트 갱신 120초다. 지정하지 않으면 2세대 함수 기본값 60초가 적용되어, 끊기면 지난 알림 때 목록을 저장하지 못한다.
- `SchedulerManager`의 레지스트리 키는 소스 이름 대신 `functionName`으로 바꾼다.

**운영 배포 확인** — Firebase CLI는 모듈의 내보낸 값을 `Object.entries`로 훑으므로(`firebase-functions/lib/runtime/loader.js:54-55`) `exports[이름] = …`도 찾을 것으로 보이지만, 이 프로젝트에서 실제로 확인한 적은 없다. 구현 때 아래 순서로 확인한다.
1. 빌드한 `lib/app/scheduler.js`를 불러와, 내보낸 이름이 `SCHEDULED_JOBS`의 `functionName`과 같은지 테스트로 확인한다(§6 테스트 9).
2. Firebase 에뮬레이터에서 함수 세 개가 모두 등록되는지 확인한다.
3. 실제 배포 뒤 Cloud Scheduler 작업 목록에 세 개가 보이는지 확인한다.
- 1·2번에서 찾지 못하면, 함수를 하나씩 `export const recruitSchedule_sria = toScheduledFunction("recruitSchedule_sria")`로 내보내고 만드는 일만 목록에서 처리한다. 테스트 9가 목록의 모든 작업이 내보내졌는지 확인하므로 빠뜨려도 조용히 어긋나지 않는다.

**사이트 갱신은 DM을 보내지 않는다**
- `NotificationEventHandler.ts`의 `RECRUIT_CHANGED` → `notifyNewRecruits` 연결(`:16-25`)이 이 파일의 전부이므로 파일을 지우고, 등록 호출(`registerEventHandlers.ts:10,50`)도 지운다. `EventBus.ts:105` 주석의 `notifyNewRecruits`와 `NotificationSendHandler.ts:15` 주석의 삭제 파일 언급도 고친다.
- `RECRUIT_CHANGED` 발행(`recruitService.ts:115-117`)은 그대로 둔다. 로그와 다른 구독자(없음)를 위한 이벤트로 남는다.

**강제 갱신 옵션** — `recruitService.syncRecruits(source, options?)`

| 옵션 | 동작 | 이유 |
|------|------|------|
| `skipIfSyncedWithinMs` | `recruit:lastSync:{source}`(마지막 갱신 성공 시각)가 이 시간 안이면 갱신하지 않고 끝낸다 | 사이트 스케줄러가 방금 갱신했으면 다시 할 필요가 없다 |
| `waitForLock` | 사이트 락(`lock:recruit:sync:{source}`)을 못 잡으면 1초 간격으로 다시 시도한다. 다시 시도할 때마다 마지막 갱신 시각을 먼저 보고, `skipIfSyncedWithinMs` 안이면 락을 잡지 않고 끝낸다(앞 갱신이 방금 성공했으므로 다시 가져올 필요가 없다). 대기 시간(`lockWaitMs`, 기본 60초. 사이트 락 만료 시간과 같다)까지 못 잡으면 실패로 보고 예외를 던진다(2026-11-01 사용자 결정). 호출한 쪽은 `Promise.allSettled`로 받아 지금 Redis 목록으로 진행한다 | 바로 건너뛰면 다른 갱신이 쓰는 중인 목록을 읽는다. 시뮬레이션(2026-10-14)에서 바로 건너뛰면 24.8%가 쓰는 중 목록을 읽었고, 기다리면 0%였다(대기 평균 3.5초, 최대 10초) |

- 옵션 없이 부르면 지금과 같다(사이트 스케줄러).
- 갱신이 끝나면 성공했을 때만 `recruit:lastSync:{source}`에 지금 시각을 저장한다. 저장은 사이트 락을 풀기 전(`try` 안)에 한다. 락을 먼저 풀면, 기다리던 알림이 그 사이에 락을 잡고 옛 시각을 읽어 같은 갱신을 한 번 더 한다.
- 앞 갱신이 실패하면 마지막 갱신 시각이 그대로라, 기다리던 알림이 락을 잡고 직접 갱신한다.
- 사이트 스케줄러와 알림이 같은 시각에 돌아도 사이트 락 때문에 한쪽만 갱신한다. 다른 쪽은 건너뛰거나(사이트 스케줄러) 기다린다(알림).

**지난 알림 때 목록** — Redis 해시 `recruit:notified:all` (공고 ID → 비교값)
- 비교값은 최신 공고 목록 비교와 같은 계산(공고 JSON의 sha256)이다. `recruitCacheService.ts:103-111`의 계산을 `common/utils/recruitHash.ts`(`hashRecruits`)로 옮겨 두 곳이 같이 쓴다.
- ID만이 아니라 비교값을 저장하는 이유: sria 공고 내용이 바뀌면 지금처럼 다시 알린다(`notificationService.ts:27`의 "추가 + 변경" 동작 유지).
- 만료 시간을 두지 않는다(2026-10-31 사용자 결정). 이 목록은 캐시가 아니라 어디까지 알렸는지 표시하는 기준이다. 밤에 알림이 쉬는 10시간이나 장애로 멈춘 시간 뒤에도 기준이 남아, 그동안 바뀐 공고를 알릴 수 있다. 알림마다 통째로 바뀌므로 쌓이지 않는다.
- 기준이 남으므로, 운영 Redis에 테스트 데이터가 있으면 첫 배포 전에 지운다(§2.11). 공고 ID 형식을 바꾸는 배포에서 DM을 원하지 않으면 그 배포 때 이 키를 직접 지운다. 키를 지워도 이벤트는 나지 않고 다음 알림이 첫 실행으로 처리된다.
- 저장은 통째로 바꾼다(`clearAndSaveHashes`). 그래서 지금 목록에 없는 ID는 남지 않는다. 지우기와 저장은 `multi()`로 묶어 한 번에 실행한다. 지운 뒤 저장이 실패하면 키가 사라져 다음 알림의 DM이 빠지기 때문이다. Upstash에서 `multi()`가 동작하는지는 구현 때 확인한다.

**중복·누락 처리**

| 상황 | 처리 | 결과 |
|------|------|------|
| 첫 배포 직후, 또는 지난 알림 때 목록 키를 지움 | 저장만 하고 보내지 않음 | 이미 받은 공고를 다시 받지 않는다. 그 사이 새 공고는 이번 회차에 알리지 않는다 |
| Cloud Scheduler가 같은 실행을 두 번 보냄 | 알림 락으로 뒤 실행 종료 | DM 1회 |
| 발송 중 함수가 멈춤 | 지난 알림 때 목록을 저장하기 전이라 다음 알림이 다시 보냄 | 이미 받은 사람은 같은 DM을 한 번 더 받을 수 있다. 누락보다 중복을 택했다. 락은 5분 뒤 만료되어 다음 알림을 막지 않는다 |
| 두 알림 사이에 생겼다가 제거된 공고 | 비교 시점에 최신 공고 목록에 없어 보내지 않음 | 사용자가 눌러도 볼 수 없는 공고는 보내지 않는다 |
| 두 알림 사이에 생겼다가 "종료"된 공고 | 바뀐 공고로 보고 목록 아래쪽에 넣어 보냄 | 정렬로 접수 중 공고 뒤에 간다 |
| 구독자 한 명에게 발송 실패 | 로그만 남기고 지난 알림 때 목록은 저장 | 그 구독자는 다음 DM에서 남아 있는 공고를 함께 받는다 |

**최신 공고 목록 키 6시간 만료** — 기존 동작이다(2025-01-11 커밋 `8402689`부터, 지금 `recruitCacheService.ts:44`). 갱신할 때마다 6시간으로 다시 맞춰지므로, 갱신이 6시간 넘게 멈췄을 때만 목록 전체가 지워진다. 이번 범위에서 바꾸지 않는다. 공고 하나가 빠지는 시점은 갱신이 정한다(elias: 모집 기간 끝·제거, sria: 데이터에서 삭제).

#### 2.8.3 이벤트 데이터와 발송 핸들러

**이벤트 데이터 변경** — `events/bus/types.ts:113-117`

```typescript
export interface NotificationSendEvent extends BaseEvent {
  userId: string;
  displays: RecruitDisplay[];   // 기존 jobs: Job[] 대체
  settings: AlarmSubscription;  // 새 형식 (regions·sources 필터)
}
```

**발송 핸들러** — `NotificationSendHandler.ts`
- `payload.jobs` → `payload.displays` (`:23,26,27,40`). `NotificationSentEvent.jobCount`는 이름을 유지하고 값만 `displays.length`로 채운다.
- embed 빌더 호출 인자는 §2.9 입력 계약을 따른다.

#### 2.8.4 공고 조회 커맨드의 읽기 경로 (`getRecruitList`)

**파일**: `services/recruitService.ts`, `services/recruitSourceService.ts`

지금은 Redis가 비면 공고 조회가 Redis 최신 공고 목록에 직접 쓴다. Firestore 목록을 다시 쓰거나(`:53-68`), 모든 사이트를 직접 가져와 쓴다(`:73-86`, `:124-148`). 둘 다 락이 없고 사이트를 구분하지 않고 목록 전체를 덮어쓴다. 사이트 갱신과 같은 함수를 부르도록 바꿔, Redis 최신 공고 목록에 쓰는 곳을 `syncRecruits` 하나로 정리한다(2026-10-29 사용자 결정, 리뷰 문서 9번).

| 순서 | 지금 | 바뀐 뒤 | `tier` |
|------|------|---------|--------|
| 1 | Redis 목록 읽기 | 그대로 | `"redis"` |
| 2 | Firestore 목록을 돌려주고 Redis에 다시 씀 | 사이트마다 `syncRecruits(source, { skipIfSyncedWithinMs: 5 * 60_000, waitForLock: true })`를 동시에 실행한 뒤 Redis 목록을 다시 읽음 | `"source"` |
| 3 | 10분 제한 확인 후 모든 사이트를 직접 가져와 Firestore·Redis에 씀 | Firestore 목록을 돌려주기만 한다. Redis에는 쓰지 않는다 | `"firestore"` |
| 4 | — | 셋 다 비면 빈 결과 | `"empty"` |

```typescript
async getRecruitList(city?: string): Promise<{ data: Recruit[] | null; tier: Exclude<RecruitTier, "error">; durationMs: number }> {
  const startedAt = Date.now();
  const done = (data: Recruit[] | null, tier: Exclude<RecruitTier, "error">) =>
    ({ data: data && filterListByCity(data, city), tier, durationMs: Date.now() - startedAt });

  // 1. Redis
  const cached = await this.readRedis();                       // 장애면 null + 로그 (지금 :41-51과 같음)
  if (cached) return done(cached, "redis");

  // 2. 사이트 갱신과 같은 함수로 채운다 (락·사이트 구분·마지막 갱신 시각을 그대로 따른다)
  await Promise.allSettled(
    getAllProviders().map(({ source }) =>
      this.syncRecruits(source, { skipIfSyncedWithinMs: 5 * 60_000, waitForLock: true })),
  );
  const synced = await this.readRedis();
  if (synced) return done(synced, "source");

  // 3. Firestore는 보여 주기만 한다. 오래된 목록이 Redis에 섞이지 않게 쓰지 않는다
  const backup = await this.firestore.getRecruitList().catch(() => null);
  if (backup?.length) return done(backup, "firestore");

  return done(null, "empty");
}
```

- 사이트 갱신 락을 똑같이 건다. 다른 갱신이 진행 중이면 끝날 때까지 기다리고, 5분 안에 갱신했으면 다시 가져오지 않는다. 알림의 다시 갱신(§2.8.2)과 같은 규칙이다.
- `syncRecruits`는 자기 사이트 공고만 비교·저장하고 사이트별 마지막 갱신 시각을 남긴다. 그래서 바로 뒤 알림이 같은 사이트를 다시 가져오지 않는다.
- 사이트마다 따로 동시에 실행한다(`Promise.allSettled`). 한 사이트가 실패해도 다른 사이트 결과는 Redis에 들어간다.
- 배포 직후 첫 예약 실행 전(elias 최대 30분, sria 최대 2시간)에도 공고 조회가 그 자리에서 사이트를 갱신하므로 빈 결과가 나오지 않는다.
- Firestore 목록은 알림이 저장한다(§2.8.2). 3번까지 내려가도 낮에는 2시간 안쪽, 밤에는 최대 10시간 안쪽의 목록을 보여 준다.
- 지우는 것: `collectAndSaveRecruits`(`:124-148`), 10분 제한 확인(`:73-77`)과 `RecruitSourceService.isRequestAllowed`(`recruitSourceService.ts:66`), `fetchAll`(`:24`, 다른 사용처 없음). 이 메서드들만 쓰던 `RecruitSourceService`의 `requestLimitStore`·`providers` 필드, `RequestLimitStore`, 그 키 함수, `HttpError` import도 함께 지운다. 10분 제한은 "5분 안에 갱신했으면 건너뜀"이 대신한다.
- `RECRUIT_CHANGED`는 `syncRecruits`가 발행한다. 이 이벤트는 DM으로 이어지지 않는다(§2.8.2).
- 공고 조회는 게이트웨이(Oracle VM)에서 돈다. 지금 4번 경로도 사이트를 직접 가져오므로 게이트웨이에 새로 생기는 의존은 없다.
- 응답 시간: Redis가 비었을 때 사이트를 가져오는 동안 기다린다. 슬래시 커맨드는 응답을 미뤄 두고(`deferReply`, `onRecruitRequest.ts`) 처리하므로 Discord 응답 시간 제한에 걸리지 않는다.

### 2.9 Discord UI

**파일**: §2.10 D 표 참조

Discord 쪽은 아래 입력 계약 세 가지만 읽는다. 소스별 공고 타입(`SriaRecruit`·`EliasRecruit`)은 읽지 않는다.

**입력 계약 1 — `RecruitDisplay`** (`common/types/recruit.d.ts`, §2.5)

| 필드 | 타입 | 보장 |
|------|------|------|
| `source` | `RecruitSource` | 항상 있음 |
| `sourceLabel` | `string` | 항상 있음 (`SourceConfig.displayName`) |
| `title` | `string` | 항상 있음 |
| `postedBy` | `string` | 항상 있음. 게시자. 자세히 모드 둘째 줄에만 그린다 |
| `url` | `string \| undefined` | 없으면 제목을 링크 없이 표시 |
| `period` | `string \| undefined` | 항상 `YYYY.MM.DD`로 시작. sria는 시간이 제거된 `2024.10.01 ~ 2024.10.15`, elias는 `2026.10.11 14:00 ~ 2026.10.12 02:00`(한국 시간) |
| `status` | `string \| undefined` | sria `recruitmentStatus`, elias `status`. 예: "접수중", "종료" |
| `extraFields` | `DisplayField[] \| undefined` | sria: 작성 시각(값이 있을 때)·마감(D-day) / elias: `eliasFields`로 정한 값만. 빈 값은 들어오지 않음 |

**입력 계약 2 — `NOTIFICATION_SEND` 이벤트 데이터** (§2.8)
- `{ userId: string; displays: RecruitDisplay[]; settings: AlarmSubscription }`
- `displays`는 1건 이상이다(0건이면 발행하지 않음). 바뀐 공고만이 아니라 구독 조건에 맞는 공고 전체다(§2.8.1). 이미 접수중 → 발표중 → 종료, 같은 상태 안 최신순으로 정렬되어 있다(§2.7).
- 지역 라벨은 `regionSummary(settings, "·")`로 만든다. 꺼진 공고의 지역을 빼야 하므로 `regions`와 `sources`를 함께 넘긴다(§2.9.5).

**입력 계약 3 — `SourceConfig`** (`providers/recruit/index.ts`, §2.4)
- `getSourceConfig(source)` → `{ displayName, url?, userFacing, ownRegionGroup?, intervalMinutes }`
- "전체 공고" 링크는 소스마다 그 소스의 `getSourceConfig(display.source).url`을 쓴다. `url`이 없으면 링크 없이 텍스트만 쓴다. `ENV.SRIA_URL` 직접 참조(`notificationMessageEmbed.ts:83`, `recruitMessageEmbed.ts:7`)는 없앤다.
- 사이트 설정 화면의 버튼은 `getUserFacingSources()`의 소스를 공고 묶음으로 나눠 만든다(`getSourceToggles()`, §2.9.5). 묶음 이름은 `displayName`이 아니라 "일반 공고", "elias 공고"다.
- 켜기/끄기 저장은 `alarmSubscriptionService.updateSources(userId, filter)`를 호출한다. 마지막 묶음은 버튼을 잠가 끌 수 없고, 서비스도 0개 저장을 검증 오류로 거부한다(§2.3).

#### 2.9.1 문구 원칙

- 사용자에게 보이는 말은 "사이트"다. "소스"는 코드와 이 문서에서만 쓴다.
- 사이트 이름은 `displayName`(`"sria"`, `"elias"`)을 그대로 쓴다.
- 아이콘은 지역 📍, 사이트 🌐로 나눈다. 지금 진입 화면은 전체 지역에 🌐을 쓴다(`subscribeEntryView.ts:22`). 사이트와 겹치므로 📍로 바꾼다.
- 알림 설정 화면은 모두 ephemeral 메시지다(`onAlarmSubscribe.ts:17`). "메시지를 닫는다"는 사용자가 이 메시지를 지우는 것을 뜻한다.

**요약 문구** — 신규 `providers/discord/builder/subscriptionSummary.ts`

```typescript
/** "전체 지역" | "서울, 부산" | "선택된 지역 없음". 꺼진 공고의 지역은 넣지 않는다. */
export function regionSummary(
  sub: Pick<AlarmSubscription, "regions" | "sources">,
  separator = ", ",
): string;

/** "모든 공고" | "일반 공고" | "elias 공고" | "받을 공고 없음". 켜진 공고 묶음 이름을 잇는다. */
export function sourceSummary(filter: AlarmFilter<RecruitSource>): string;
```

| 화면 | 지금 | 바뀐 뒤 |
|------|------|--------|
| 진입 화면, 켜짐 + 전체 지역 | `🔔 알림 **켜짐** · 🌐 전체 지역` | `🔔 알림 **켜짐** · 📍 전체 지역 · 🌐 모든 공고` |
| 진입 화면, 켜짐 + 선택 지역 | `🔔 알림 **켜짐** · 📍 현재 선택 지역: 서울, 부산` | `🔔 알림 **켜짐** · 📍 서울, 부산 · 🌐 일반 공고` |
| 진입 화면, 꺼짐·문서 없음 | — | 그대로 |
| DM 배너 첫 줄 | `📢 서울·부산 · 총 N건` | 그대로. 지역 라벨은 `regionSummary(settings, "·")` |

#### 2.9.2 공고 목록 그리기 (DM 알림·공고 조회 공용)

**파일**: 신규 `providers/discord/builder/embeds/recruitList.ts`, `jobLink.ts`

두 embed는 이 파일로만 목록을 만든다. `jobLink.ts`는 `formatJobTitleLink`만 남기고 `recruitField`는 지운다. 더 이상 소스별 공고 타입을 읽지 않기 때문이다.

```typescript
/** "simple"(간단히) = DM 알림, "detailed"(자세히) = 공고 조회 커맨드 */
export type DisplayDetail = "simple" | "detailed";

/** 공고 한 건. index는 1부터. */
export function formatRecruitLine(d: RecruitDisplay, index: number, detail: DisplayDetail): string;

/** 사이트별 묶음. 블록 하나 = 머리줄 + 상위 topCount건 + 꼬리줄. */
export function formatRecruitGroups(
  displays: RecruitDisplay[],
  options: { detail: DisplayDetail; topCount: number },
): { blocks: string[]; hasOverflow: boolean };
```

**공고 한 건의 모양**

| 모드 | 모양 | 규칙 |
|------|------|------|
| 간단히 | `1. [서울][접수중] 카페 스태프`<br>`📅 2024.10.01 ~ 2024.10.15` | 첫 줄은 상태를 넣은 제목. 둘째 줄은 `📅 {period}`. `period`가 없으면 둘째 줄을 뺀다. `postedBy`와 `extraFields`는 그리지 않는다 |
| 자세히 | `1. [서울][접수중] 카페 스태프`<br>`📅 2024.10.01 ~ 2024.10.15 \| 한빛이벤트 \| 마감 D-5` | 첫 줄은 상태를 넣은 제목. 둘째 줄은 `📅 {period}`, `{postedBy}`, `extraFields`의 `{name} {value}` 칸들 순서로 ` \| `로 잇는다. 값이 빈 칸은 뺀다 |

**제목에 상태 넣기** (두 모드 공통, 2026-10-27 사용자 결정)
- 지역은 따로 저장된 값이 아니라 제목 맨 앞의 `[…]`다(sria 데이터 제목, elias `[한글 지역] 제목`).
- 제목이 `[…]`로 시작하면 그 바로 뒤에 `[{status}]`를 넣는다. `[…]`로 시작하지 않으면 제목 맨 앞에 붙인다. `status`가 없으면 넣지 않는다.
- 이 처리는 `recruitList.ts`에서만 한다. 공고 데이터의 제목은 바꾸지 않으므로 비교값에 영향이 없다.
- DM에 "발표중"·"종료" 공고도 들어가므로(§2.7 ②) 상태가 보여야 구분할 수 있다. 공고 조회도 같은 모양으로 맞춰, 같은 공고가 두 화면에서 같게 보인다.

- 제목은 `url`이 있으면 `formatJobTitleLink(상태를 넣은 제목, url)`로 링크를 건다. `[서울][접수중] 카페 스태프` 전체가 링크 글자가 된다.
- `period`는 `toDisplay()`가 만든 글자를 그대로 쓴다. embed는 날짜 형식을 바꾸지 않는다.
- sria 자세히 예 (작성 시각이 있을 때): `1. [서울][접수중] 주말 카페 오픈 단기 스태프 모집` / `📅 2026.09.06 ~ 2026.09.13 | 한빛이벤트 | 작성 09.05 10:30 | 마감 D-5`. 작성 시각이 없으면 `작성` 칸이 빠진다.
- elias 자세히 예: `1. [요정 왕국][접수중] 어제 팔리지 않은 빵 판매` / `📅 2026.10.11 14:00 ~ 2026.10.12 02:00 | 요정 왕국`. `eliasFields`로 정한 값이 있으면 게시자 뒤에 칸으로 붙는다. `extraFields`의 `name`은 `toDisplay()`가 준 그대로 보인다(§2.5).

**사이트 구분 — 사이트별로 묶는다**

```
**🌐 sria** · 5건
1. [서울][접수중] 카페 스태프
📅 2024.10.01 ~ 2024.10.15
2. …
3. …
▸ 이 외 2건 더 있어요 · [전체 공고 보기](https://…)

**🌐 elias** · 1건
1. [세계수 교단][종료] 교단 가입시키기
📅 2026.10.11 14:00 ~ 2026.10.12 02:00
```

항목마다 배지를 붙이는 방식 대신 묶기를 고른 근거:
1. "전체 공고" 링크가 사이트마다 다르다. 묶으면 링크가 그 사이트 항목 바로 아래에 붙어 어느 목록의 링크인지 분명하다. 배지 방식은 목록 끝에 사이트별 링크를 따로 늘어놓아야 한다.
2. 상위 건수를 사이트마다 따로 센다. 한 사이트 공고가 많아도 다른 사이트 공고가 가려지지 않는다. 지금 DM은 전체에서 상위 3건만 보여 준다(`notificationMessageEmbed.ts:88`).
3. 사이트 이름을 머리줄에 한 번만 쓰면 공고 줄이 짧게 유지된다.

- 대가: 사이트가 하나여도 머리줄이 붙는다. 한 메시지에 보이는 건수는 최대 "사이트 수 × 3건"이 된다.
- 사이트 순서는 `getUserFacingSources()` 순서(sria → elias)를 따른다. 이 목록에 없는 사이트 항목이 들어오면 빠뜨리지 않고 그 뒤에 들어온 순서대로 붙인다.
- 블록 안 항목은 들어온 순서를 지킨다. 들어오기 전에 정렬되어 있으므로(DM은 상태순 + 최신순 §2.8.1, 조회는 최신순 §2.9.4) 이 파일은 순서를 바꾸지 않는다. DM의 상위 3건은 접수 중인 최신 공고부터 채워진다. 블록 사이는 빈 줄로 나눈다. 항목 사이는 간단히는 줄바꿈 한 번, 자세히는 빈 줄로 나눈다.
- 머리줄 이름은 `display.sourceLabel`을 쓴다.

**꼬리줄 ("전체 공고" 링크)**

| 경우 | 간단히 | 자세히 |
|------|--------|--------|
| 상위 3건 밖 공고 있음 | `▸ 이 외 {n}건 더 있어요 · [전체 공고 보기]({url})` | 같음 |
| 밖 공고 없음 | 꼬리줄 없음 (지금 DM 동작) | `🔗 [전체 공고 보기]({url})` (지금 조회 커맨드처럼 링크를 항상 표시) |

- `url`은 `getSourceConfig(source).url`이다. 없으면 링크 부분만 뺀다. 자세히 + 밖 공고 없음 + `url` 없음이면 꼬리줄이 없다.
- 조회 커맨드의 "공고 페이지 URL이 설정되지 않아…" 문구(`recruitMessageEmbed.ts:15`)는 없앤다.
- `hasOverflow`는 꼬리줄에 "이 외 n건"이 붙은 블록이 하나라도 있으면 `true`다.

**목록은 embed description 하나에 넣는다.** embed 필드 값 한도는 1024자라 자세히 모드 3건과 링크가 넘을 수 있다. description 한도는 4096자다. 지금 DM도 description을 쓴다(`notificationMessageEmbed.ts:111`).

#### 2.9.3 DM 알림 embed

**파일**: `providers/discord/builder/embeds/notificationMessageEmbed.ts`, `events/bus/handlers/NotificationSendHandler.ts`

```typescript
export function notificationBannerContent(displays: RecruitDisplay[], settings: AlarmSubscription): string;
export function notificationMessageEmbed(displays: RecruitDisplay[], settings: AlarmSubscription): APIEmbed;
```

- 목록: `formatRecruitGroups(displays, { detail: "simple", topCount: 3 })`.
- 배너 content: 지금 모양을 유지한다. 지역 라벨은 `regionSummary(settings, "·")`, 건수는 `displays.length`(구독 조건에 맞는 공고 전체 수).
- 지역 안내문("지역 필터로 조회된 공고예요…")은 지금처럼 지역이 SELECTED이고 `hasOverflow`일 때 맨 아래에 붙인다. 조건은 `settings.alertMode` 대신 `settings.regions.mode`로 본다.
- `trimDate`(`:38-41`)는 sria 변환으로 옮긴다(§2.5). `ENV`·`Job`·`CITIES` import는 없앤다.
- 색(`0x00b0f4`)과 타임스탬프는 유지한다.
- `NotificationSendHandler.ts:26-27`은 `payload.displays`를 넘긴다(§2.8).

**간단히 모드에서 빠지는 값** (사용자 확인 대상)

지금 DM은 공고마다 세 줄이다: 제목(링크) / `📅 기간` / `⏳ 마감 D-day · 🏷️ 모집 상태` (`notificationMessageEmbed.ts:88-92`).

| 빠지는 값 | 지금 위치 | 볼 수 있는 곳 |
|-----------|----------|--------------|
| 마감 D-day (sria `dDay`) | 셋째 줄 ⏳ | 공고 조회 커맨드(자세히)의 "마감" 칸 |

- 모집 상태는 빠지지 않는다. 모든 공고의 제목 지역 뒤에 `[{status}]`로 들어간다(§2.9.2 제목에 상태 넣기).

- elias 고유 값(`eliasFields`로 정한 값)은 지금 DM에도 나오지 않으므로 새로 빠지는 값이 아니다.
- "종료"·"발표중" 공고도 DM 목록 아래쪽에 들어간다(§2.7 ②). 제목의 `[상태]`로 구분한다.
- 기간 글자: sria `2024.10.01 ~ 2024.10.15`, elias `2026.10.11 14:00 ~ 2026.10.12 02:00`. 2026-10-14 결정으로 elias에 연도를 넣는다(§2.5 기간 형식 규칙). embed는 받은 글자를 그대로 쓴다.
- 안내 문구: embed description 맨 아래에 빈 줄 하나를 두고 `접수 중인 공고부터 최신순으로 보여드려요.`를 항상 붙인다. 지역 안내문이 붙는 경우에는 그 아래에 둔다. "종료" 공고를 빼던 10-14 문구를 2026-10-27 결정에 맞춰 바꾼 것이다.

#### 2.9.4 공고 조회 커맨드

**파일**: `events/listeners/commands/onRecruitRequest.ts`, `providers/discord/builder/embeds/recruitMessageEmbed.ts`

```typescript
// onRecruitRequest.ts:56-61 변경
const visible = new Set(getUserFacingSources());
const displays = sortByStartDateDesc(
  (data ?? []).filter((r) => visible.has(r.source)),
  (r) => r,
).map(toDisplay);
if (displays.length === 0) {
  await interaction.editReply(`❌ \`${region ?? "전체"}\` 지역에 대한 공고가 없어요.`);
  return;
}
await interaction.editReply({ embeds: [recruitMessageEmbed(displays, region)] });
```

- 숨긴 사이트(`userFacing: false`)는 조회 결과에도 나오지 않는다. 사이트 설정 화면·발송과 같은 기준이다.
- "종료" 공고는 거르지 않는다. 제목에 `[종료]`로 그대로 보인다.
- 정렬은 상태와 상관없이 시작 시점 최신순이다. 기간이 남은 "종료" 공고가 위에 올 수 있다(2026-10-14 사용자 결정, 2026-10-27 재확인). DM의 상태순 정렬은 쓰지 않는다.
- 이 거르기는 로컬 Redis에 남은 옛 `temp:` 항목(§2.11)도 걸러 낸다. 그 항목은 `source`가 `"temp"`라 `toDisplay()`에 넘기면 검증 오류가 나고, 커맨드 전체가 "공고 요청 처리 중 오류"로 끝난다.
- 지역 없이 조회해 결과가 0건이면 지금은 문구에 `undefined`가 찍힌다(`:57`). 같은 줄을 고치므로 `region ?? "전체"`로 함께 바로잡는다.
- `RECRUIT_REQUEST_COMPLETED` 이벤트의 `jobs`는 지금처럼 `data`(`Recruit[]`)를 넘긴다.

```typescript
// recruitMessageEmbed.ts
export function recruitMessageEmbed(list: RecruitDisplay[], region?: string): APIEmbed;
```

- 제목 `📢 {region ?? "전체"} 지역 공고`와 0건 분기(`📭 …`, 빨간색)는 유지한다.
- description: `총 {N}건의 공고가 검색되었어요. 사이트마다 상위 3건을 먼저 보여드릴게요.` + 빈 줄 + `formatRecruitGroups(list, { detail: "detailed", topCount: 3 }).blocks`.
- `addFields`로 넣던 방식과 템플릿 문자열 들여쓰기(`:23-38`)를 없앤다. `ENV.SRIA_URL`(`:7`)도 없앤다.

#### 2.9.5 사이트 설정 화면

**파일**: 신규 `providers/recruit/sourceToggle.ts`, 신규 `providers/discord/builder/buttons/sourceToggleButtons.ts`, 신규 `events/listeners/buttons/renderSourceSettings.ts`, 신규 `events/listeners/buttons/onSourceToggle.ts`

사이트를 하나씩 고르는 대신 공고 묶음을 켜고 끈다(2026-11-03 사용자 결정). 한국 지역을 쓰는 사이트는 사용자가 고르는 지역이 같으므로 "일반 공고" 하나로 묶고, 고유 지역이 있는 사이트만 따로 켜고 끈다.

| 공고 묶음 | 든 사이트 | 지역 메뉴에 보이는 권역 |
|-----------|----------|----------------------|
| 일반 공고 | `ownRegionGroup`이 없는 사이트 전체 (지금은 sria) | 광역시 ~ 제주 10개 |
| elias 공고 | elias | `elias 지역` |

```typescript
// providers/recruit/index.ts SourceConfig에 추가. 없으면 한국 지역을 쓰는 사이트다.
ownRegionGroup?: CityGroupKey;   // elias: "eliasRegions"

// providers/recruit/sourceToggle.ts
export function getSourceToggles(): SourceToggle[];                     // 노출 사이트가 있는 묶음
export function isToggleOn(toggle, filter): boolean;                    // 묶음 안의 사이트가 하나라도 저장돼 있으면 켜짐
export function expandSourceFilter(filter): AlarmFilter<RecruitSource>; // 켜진 묶음의 사이트 전체로 넓힘
export function toggleSourceFilter(filter, key): AlarmFilter<RecruitSource> | null; // 끌 수 없으면 null
export function visibleRegionGroups(filter): CityGroupKey[];            // 지역 메뉴에 보일 권역
export function isRegionInToggle(region, toggle): boolean;
```

**저장값** — `sources` 형식은 그대로 쓴다.

| 켜진 공고 | `sources` | 지역 메뉴 | 받는 공고 |
|----------|-----------|---------|---------|
| 둘 다 | `{ mode: "ALL" }` | 전체 | 전부 |
| 일반 공고만 | `{ mode: "SELECTED", values: ["sria"] }` | 한국 권역 | 한국 사이트 공고 |
| elias 공고만 | `{ mode: "SELECTED", values: ["elias"] }` | `elias 지역` | elias 공고 |

- 알림 판정은 사이트 필터 앞에 `expandSourceFilter`를 쓴다(§2.8 ③). 그래서 `SELECTED ["sria"]`인 구독자도 나중에 추가되는 한국 사이트를 함께 받는다. 데이터 변환은 없다.
- 모든 지역 모드에서는 켜진 공고를 전부 받는다. elias 공고만 켰으면 elias 공고 전부다.
- 지역 선택 모드에서 서울을 골라도 elias 공고는 오지 않는다. 지역 필터가 제목을 보기 때문이다(§2.7).

**화면** (`renderSourceSettings.ts`)

| 항목 | 값 |
|------|-----|
| 메시지 content | 첫 줄 `받을 공고를 켜거나 꺼 주세요`<br>둘째 줄 `버튼을 누르면 바로 저장돼요`<br>그 아래 공고마다 인용 블록 한 줄 (`> 일반 공고: 대한민국 지역의 공고`, `> elias 공고: elias 지역의 공고`) |
| 켜진 버튼 | `✅ 일반 공고`, 초록색 |
| 꺼진 버튼 | `⬜ elias 공고`, 회색 |
| 잠금 | 켜진 묶음이 하나뿐이면 그 버튼을 잠근다 |
| 뒤로 | [⬅️ 뒤로] → 설정 관리 화면 |

- 메뉴 대신 버튼을 쓰는 이유: Discord 메뉴는 닫히는 순간 제출되어 사용자가 저장 시점을 알기 어렵다. 버튼은 누른 결과가 바로 보인다.
- 다 끌 수 없게 막는 이유: 받을 공고가 없는 구독 상태를 만들지 않기 위해서다. 알림을 완전히 끄는 것은 진입 화면의 끄기 버튼이 맡는다.
- 저장 처리: 버튼 잠금 → 구독 조회 → `toggleSourceFilter` → `updateSources` → 화면 다시 그리기. `toggleSourceFilter`가 null이면 저장하지 않는다. 다른 창에서 먼저 바꾼 경우다.

**지역 안내** — 권역 메뉴 위에도 사이트 설정 화면과 같은 공고 설명을 인용 블록으로 보여 준다. 공고가 둘 다 켜져 있을 때만 넣는다. 하나만 켜져 있으면 고를 수 있는 지역이 그 공고 것뿐이라 넣지 않는다.

**꺼진 공고의 지역** — 저장값에서 지우지 않고 화면에서만 뺀다. 다시 켜면 그대로 쓰기 위해서다. `activeRegions(sub)`가 켜진 공고의 지역만 돌려준다.

| 대상 | 동작 |
|------|------|
| 설정 화면, 진입 화면 요약, 알림 DM 첫 줄, 지역 제거 메뉴 | 켜진 공고의 지역만 보여 준다. 공고 묶음 순서, 그 안에서 한글 가나다순이다 |
| 설정 화면 표시 | `현재 선택 지역` 아래에 켜진 공고마다 인용 블록 한 줄을 보여 준다. 지역 이름은 인라인 코드로 감싼다(`> 일반 공고: `수원` `충주``). 고른 지역이 없는 공고는 `> {공고 이름}: 선택한 지역 없음`으로 보여 준다. 진입 화면 요약과 알림 DM 첫 줄은 글자로 둔다 |
| 켜진 공고의 지역이 0개 | `선택된 지역 없음` 경고를 보여 주고 [➖ 제거]·[🧹 초기화]를 잠근다 |
| [🧹 초기화] | 화면에 보이는 지역만 지운다 |
| 지역 개수 제한 | 공고별 `MAX_REGION_COUNT`개. 켜진 공고가 모두 차야 [➕ 추가]를 잠근다. 한쪽만 찼을 때 그쪽 지역을 고르면 `대한민국 지역은 최대 2개까지 선택할 수 있어요` |
| 지역 모드가 ALL일 때 지역 편집 | 지역을 고르던 때 열어 둔 메시지에서 [➕ 추가]·[➖ 제거]·[🧹 초기화] 버튼이나 그 메시지에 열려 있던 추가·제거 메뉴를 쓴 경우다. 메뉴를 열거나 저장하지 않고, `지금은 모든 지역 알림을 받고 있어요. 지역을 고르려면 **🔀 모드 변경**을 눌러 주세요.`와 함께 지역 화면을 다시 그린다(`rerenderIfAllRegions`). 버튼 이름은 굵게 써서 아래 버튼과 같은 것임을 보여 준다. `updateRegions`는 항상 SELECTED로 저장하므로, 저장하면 전체 지역 알림이 끊기기 때문이다(2026-11-05 사용자 결정) |

**지역 추가 메뉴** — `regionGroupSelectMenu(sub.sources)`는 켜진 공고의 권역만 보여 준다. `subscribeAdd`는 구독 정보를 읽어야 하므로 버튼을 잠근 뒤 메뉴를 그린다.

| 항목 | 값 |
|------|-----|
| 권역 옵션 | label `{권역} ▸`, description `수원, 성남 외 17곳` |
| 1단계 문구 | `1/2단계 — 권역을 선택하세요` |
| 2단계 문구 | `2/2단계 — {itemPrompt}`. 일반 권역 `시를 선택하세요`, elias 지역 `지역을 선택하세요` |
| 1단계 뒤로 | [⬅️ 뒤로] → 지역 화면 (`SUBSCRIBE_OPTION:REGION`) |
| 2단계 뒤로 | [⬅️ 뒤로] → 1단계 권역 메뉴 (`REGION_EDIT:ADD`) |
| 지역 제거 메뉴 뒤로 | [⬅️ 뒤로] → 지역 화면 (`SUBSCRIBE_OPTION:REGION`) |

권역을 고르면 그 메뉴를 먼저 잠그고(`update`) 시 메뉴로 바꾼다(`editReply`). 응답 한 번으로 메뉴를 다른 메뉴로 바로 바꾸면 Discord 앱에 로딩 표시가 남고, 시를 골라도 요청이 오지 않는 일이 있었다.

#### 2.9.6 첫 구독 흐름

첫 구독에서 사이트를 묻지 않는다(2026-11-03 사용자 결정). 처음에는 일반 공고만 받고, elias 공고는 사이트 설정 화면에서 켠다(2026-11-05 사용자 결정). 지역 모드 질문과 그 뒤 화면은 그대로다.

```
[🔔 알림 켜기] (문서 없음)
  → 지역 모드 질문 [모든 지역] [지역 선택]
  → subscribe({ enabled: true, regions, sources: initialSourceFilter() })
  → 모든 지역: 진입 화면 / 지역 선택: 지역 화면
```

- `initialSourceFilter()`(`providers/recruit/sourceToggle.ts`)는 "일반 공고" 묶음의 사이트만 고른 `SELECTED`를 돌려준다. 지금은 `{ mode: "SELECTED", values: ["sria"] }`다. sria를 직접 적지 않고 묶음에서 계산하므로 한국 사이트가 늘어도 일반 공고 전체가 켜진다.
- 그래서 첫 구독자의 요약은 `🌐 일반 공고`이고, 지역 추가 메뉴에 `elias 지역`이 보이지 않는다.
- 이미 구독한 사람과 `sources`가 없는 옛 문서(모든 공고로 읽음, §2.2)는 바뀌지 않는다.

#### 2.9.7 설정 관리 화면

지금은 [⚙️ 설정 관리]를 누르면 바로 지역 화면(관리 embed + [🔀 모드 변경] [⬅️ 뒤로], 선택 지역이면 [➕ 추가] [➖ 제거] [🧹 초기화])이 나온다. 그 사이에 설정 관리 화면 하나를 끼운다. 지역 화면은 그대로 두고 한 단계 아래로 내린다.

```
진입 화면 [⚙️ 설정 관리]
  → 설정 관리 화면 (관리 embed)  [📍 지역 설정] [🌐 사이트 설정] [⬅️ 뒤로 → 진입 화면]
       ├ 📍 지역 설정 → 지역 화면 (지금 관리 화면 그대로)  [🔀 모드 변경] [⬅️ 뒤로 → 설정 관리 화면] (+ ➕ ➖ 🧹)
       │                └ 모드 변경 → 확인 → 지역 화면 (기존)
       └ 🌐 사이트 설정 → 공고 켜기/끄기 버튼 + [⬅️ 뒤로 → 설정 관리 화면] (누르면 바로 저장, 같은 화면 유지)
```

- 고른 이유: 요청한 배치([지역 설정] [사이트 설정] 나란히)를 따르면서 지역 흐름(모드 변경 확인, 지역 추가·제거·초기화)의 핸들러를 그대로 둔다. 지역 화면을 다시 그리는 `renderSubscribeManage` 호출부도 바뀌지 않는다.
- 대가: 지역을 고치려면 한 번 더 누른다.
- 다른 안: 지금 지역 화면 첫 줄에 [🌐 사이트 설정]만 더하는 방법도 있다. 누르는 횟수는 그대로지만, 지역 버튼과 사이트 버튼이 한 화면에 섞여 요청한 배치와 다르다.
- 지역 화면의 [⬅️ 뒤로]는 customId를 `SUBSCRIBE_OPTION:BACK` 대신 `SUBSCRIBE_OPTION:MANAGE`로 달아 설정 관리 화면으로 돌아가게 한다. ID 값 자체는 바뀌지 않는다.
- 사이트 설정 화면의 [⬅️ 뒤로]도 `SUBSCRIBE_OPTION:MANAGE`를 쓴다.

**관리 embed** (`subscribeManageEmbed.ts`) — 설정 관리 화면과 지역 화면이 함께 쓴다.

| 필드 | 지금 | 바뀐 뒤 |
|------|------|--------|
| 알림 상태 | 🔔 켜짐 / 🔕 꺼짐 | 그대로 |
| 알림 모드 | 🌐 전체 지역 / 📍 선택 지역 | 없앤다. 사이트에도 전체·선택이 생겨 무엇의 모드인지 모호하다. "지역" 필드로 합친다 |
| 지역 | 선택 지역일 때만 | 항상. 전체면 `📍 전체 지역`, 선택이면 `selectedRegionContent(activeRegionsByToggle(sub))`. 켜진 공고마다 한 줄로 보여 준다(§2.9.5) |
| 사이트 | 없음 | `🌐 {sourceSummary(sub.sources)}` |

**버튼 ID 추가** (기존 ID 값은 바꾸지 않는다)

| customId | 버튼 | 핸들러 (신규 `events/listeners/buttons/`) |
|----------|------|------|
| `SUBSCRIBE_OPTION:REGION` | 📍 지역 설정 | `onShowRegionSettings.ts` → `renderSubscribeManage` |
| `SOURCE_SELECT:OPEN` | 🌐 사이트 설정 | `onSourceSelectOpen.ts` → `renderSourceSettings` |
| `SOURCE_SELECT:TOGGLE_KOREA` | 일반 공고 | `onSourceToggle.ts` (`key: "korea"`) |
| `SOURCE_SELECT:TOGGLE_ELIAS` | elias 공고 | `onSourceToggle.ts` (`key: "elias"`) |

- `SUBSCRIBE_OPTION:REGION`은 `SubscribeOptionAction` enum에 `REGION`을 더한다. 핸들러 맵은 `showSubscribeOptionHandler.ts`.
- `SOURCE_SELECT`는 신규 `features/alarmSubscribe/constants/sourceSelectAction.ts`(`SOURCE_SELECT_PREFIX`, `SourceSelectAction`, `sourceSelectActionId`)에 둔다. 핸들러 맵은 신규 `events/handlers/buttons/sourceSelectHandlers.ts`를 `buttons/index.ts`에 합친다.
- `constants/index.ts` export와 `fullActionId.ts`(`SUBSCRIBE_OPTION_REGION`, `SOURCE_SELECT_OPEN`·`_TOGGLE_KOREA`·`_TOGGLE_ELIAS`, `SourceSelectActionId` 타입)에 추가한다. `fullActionId`에 없는 버튼은 `onInteraction.ts:31`에서 막힌다.
- 신규 빌더: `buttons/subscribeSettingsHubButtons.ts`(설정 관리 화면), `buttons/sourceToggleButtons.ts`(사이트 설정 화면).
- 신규 `events/listeners/buttons/renderSubscribeSettingsHub.ts`: 설정 관리 화면을 그린다. `renderSubscribeManage`와 같은 모양에 `notice?: string` 인자를 둔다. `onShowSubscribeManage.ts:21`은 이 함수를 부른다.
- `renderSubscribeManage`에도 `notice?: string` 인자를 더한다. 없으면 content를 비운다. `rerenderIfAllRegions`가 이 인자로 안내 문구를 넘긴다(§2.9.5).
- 새 핸들러는 모두 `withDisabledComponents(interaction, work)`(`providers/discord/builder/disableMessageComponents.ts`)로 감싼다. 이 함수는 `update`로 컴포넌트를 잠근 뒤 `work`를 실행하고, `work`가 실패하면 원래 컴포넌트로 되돌린 뒤 예외를 다시 던진다.

#### 2.9.8 에러 처리

- 사이트 0개 저장은 마지막 버튼 잠금, `toggleSourceFilter`, 서비스 검증(§2.3) 세 곳에서 막는다.
- 사이트 저장 전에 서비스가 `ensureExists`로 문서를 만들어 두므로(§2.3), 화면을 연 사이에 문서가 지워져도 저장이 NOT_FOUND 오류로 끝나지 않는다.
- 문서가 없는 사용자가 지역 설정·사이트 설정·공고 켜기/끄기 버튼을 누르면 기존 방어 문구(`아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.` + [⬅️ 뒤로])를 보여 준다.
- embed는 값이 없는 칸을 빼고 그린다. 두 호출부(발송·조회)는 노출 사이트 공고만 넘긴다(§2.8 ①, §2.9.4).

### 2.10 `alertMode`·`regions` 참조 지점 전체 목록

`grep alertMode|AlertMode|regions` 결과(`.ts` 32개 파일)를 컴파일 영향으로 나눴다. A에 16개, B에 16개가 있다. B의 2개(`formatRegionList.ts`, `regionSelectMenus.ts`)는 뒤에 공고별 지역 표시로 바뀌어 D 표로 옮겼다. A의 #6·#8은 grep에 걸리지 않지만 같은 변경으로 함께 고친다. 소스 이름 변경(temp → elias)으로 바뀌는 파일은 §2.11에 따로 적는다. 타입을 먼저 바꾸면 "수정 필요" 항목은 컴파일 오류로 드러난다.

**바꿔 쓰기 규칙** (UI 쪽 기계적 수정)

| 기존 | 변경 |
|------|------|
| `sub.alertMode` | `sub.regions.mode` |
| `sub.regions` (배열로 사용) | `selectedValues(sub.regions)` |
| `subscribe(userId, { enabled, alertMode: X, regions: [] })` | `subscribe(userId, { enabled, regions: X === ALL ? {mode:"ALL"} : {mode:"SELECTED", values: []}, sources: initialSourceFilter() })` (§2.9.6) |

**A. 수정 필요 (grep 16개 + 추가 2개)**

| # | 파일:줄 | 내용 | 담당 |
|---|---------|------|------|
| 1 | `common/types/alarmSubscription.ts:24-40` | 타입 재구성 (§2.1) | Integration |
| 2 | `common/types/index.ts:27-28` | `AlarmFilter` export 추가 | Integration |
| 3 | `common/utils/recruitFilter.ts:8-9,25-35,47-51` | 필터 재구성, `getRecruitStatus`·`sortForNotification` 추가 (§2.7) | Integration |
| 4 | `providers/firebase/store/subscription.ts:7-8,22-29,77-86,95-106` | 저장 형식 (§2.2) | Integration (Backend Expert) |
| 5 | `features/alarmSubscribe/services/subscriptionService.ts:1-2,16,27-30,81-86,103-108,156,193-197` | 서비스 (§2.3) | Integration |
| 6 | `services/notificationService.ts:5,27-44` | 발송 (§2.8) — `alertMode` 문자열은 없지만 `filterByMode` 삭제로 오류 | Integration |
| 7 | `events/bus/types.ts:98,113-117` | 이벤트 데이터 (§2.8) | Integration |
| 8 | `events/bus/handlers/NotificationSendHandler.ts:23-27,40` | `displays` 대응 (§2.8) | Integration |
| 9 | `providers/discord/builder/subscribeEntryView.ts:21-24` | `regionSummary`·`sourceSummary`로 요약 줄 (§2.9.1) | Discord |
| 10 | `providers/discord/builder/embeds/subscribeManageEmbed.ts:13,24-25` | 필드 재구성: 알림 상태·지역·사이트 (§2.9.7) | Discord |
| 11 | `providers/discord/builder/embeds/notificationMessageEmbed.ts:4,22-27,57-112` | `RecruitDisplay` 기반으로 교체 (§2.9.3) | Discord |
| 12 | `providers/discord/builder/buttons/subscribeManageButtons.ts:22-31` | `selectedValues(sub.regions)`, [⬅️ 뒤로] customId → `SUBSCRIBE_OPTION:MANAGE` (§2.9.7) | Discord |
| 13 | `events/listeners/selectMenus/onRegionCitySelect.ts:47-64` | `const current = selectedValues(sub.regions)`, 공고별 개수 제한 `isToggleFull`, 지역 모드가 ALL이면 저장 안 함 (§2.9.5) | Discord |
| 14 | `events/listeners/selectMenus/onRegionRemoveSelect.ts:46-48` | `selectedValues(sub.regions).filter(...)`, 지역 모드가 ALL이면 저장 안 함 (§2.9.5) | Discord |
| 15 | `events/listeners/buttons/subscribeRemove.ts:48,58` | 제거 메뉴는 `activeRegions(sub)`로 켜진 공고의 지역만, [⬅️ 뒤로] 추가, 지역 모드가 ALL이면 메뉴를 열지 않음 (§2.9.5) | Discord |
| 16 | `events/listeners/buttons/onEnableAllRegionAlert.ts:31-35` | `subscribe` 입력 새 형식 (§2.9.6) | Discord |
| 17 | `events/listeners/buttons/onEnableSelectedRegionAlert.ts:32-36` | `subscribe` 입력 새 형식 (§2.9.6) | Discord |
| 18 | `features/alarmSubscribe/ai/interpreter.ts:2,13` | `AlertMode` 타입은 유지되므로 오류 없음. 컴파일 확인만 | — |

**B. 변경 없음 — `AlertMode` 값·타입만 쓰거나 이름만 일치 (14개 파일, D로 옮긴 2개 제외)**

이 절의 구독 타입 변경 기준이다. 일부 파일은 D·E 표의 다른 이유로 수정된다.

| 파일:줄 | 이유 |
|---------|------|
| `features/alarmSubscribe/types/alarmSubscribeCommand.ts:1,10,26` | `AlertMode` 타입 유지 |
| `features/alarmSubscribe/constants/alertModeSelectAction.ts:1,13-15` | `AlertMode` 값 유지 → 버튼 ID 불변 |
| `features/alarmSubscribe/constants/index.ts:8-9` | 이름만 일치 |
| `features/alarmSubscribe/constants/fullActionId.ts:6,32-33,55` | 이름만 일치 |
| `features/alarmSubscribe/index.ts:24` | 이름만 일치 |
| `features/alarmSubscribe/ai/handler.ts:25,45` | 자연어 해석 결과의 `regions?: string[]` — 구독 문서와 무관 |
| `events/handlers/buttons/alertRegionEditHandlers.ts:2,18,23,28` | `AlertMode.SELECTED` 값 사용 |
| `events/handlers/buttons/alertModeSelectHandlers.ts:5` | 이름만 일치 |
| `events/handlers/buttons/index.ts:5,13` | 이름만 일치 |
| `events/listeners/buttons/onChangeConfirm.ts:25-27` | `getUserAlertMode`·`updateMode` 시그니처 유지 |
| `events/listeners/buttons/onChangeRequest.ts:19-22` | `getUserAlertMode` 시그니처 유지 |
| `events/listeners/buttons/onShowSubscribeEnable.ts:4,40` | 이름만 일치 |
| `providers/discord/builder/buttons/showAlertModeSelectButtons.ts:2-11` | 이름만 일치 |
| `providers/discord/builder/buttons/showConfirmChangeAlertModeButtons.ts:4` | 이름만 일치 |

`onEnableAllRegionAlert.ts:28,37`·`onEnableSelectedRegionAlert.ts:29,38`도 서비스 시그니처가 유지되므로 그 줄은 바뀌지 않는다. B에 있던 `formatRegionList.ts`·`regionSelectMenus.ts`와 서비스 호출 줄만 그대로이던 `subscribeClear.ts`는 공고별 지역 표시 때문에 바뀌므로 D 표에 적는다.

**C. 문서 (코드 아님, 갱신 대상)**
- `providers/CLAUDE.md:100-124` — Firestore 스키마·메서드 표
- `services/CLAUDE.md:151-229`, `features/CLAUDE.md:67-77` — 옛 예시 코드
- `events/bus/CLAUDE.md:97-121` — 삭제되는 `NotificationEventHandler` 예시
- `.claude/docs/ARCHITECTURE.md:176-183` — 공고 조회 순서

**D. Discord UI — 새로 만들거나 바뀌는 파일 (§2.9, A 표에 없는 것)**

| 파일 | 변경 | 내용 |
|------|------|------|
| `providers/discord/builder/embeds/recruitList.ts` | 신규 | 공고 한 건·사이트별 묶음 그리기 (§2.9.2) |
| `providers/discord/builder/embeds/jobLink.ts` | 수정 | `recruitField` 삭제, `formatJobTitleLink`만 남김 |
| `providers/discord/builder/embeds/recruitMessageEmbed.ts` | 수정 | `RecruitDisplay[]` 입력, 자세히 모드, `ENV.SRIA_URL` 삭제 (§2.9.4) |
| `events/listeners/commands/onRecruitRequest.ts:56-61` | 수정 | 노출 사이트 거르기 → `toDisplay()` → embed (§2.9.4) |
| `providers/discord/builder/subscriptionSummary.ts` | 신규 | `regionSummary`·`sourceSummary` (§2.9.1), 공고 설명 인용 블록 `sourceDescriptions` (§2.9.5) |
| `providers/discord/builder/buttons/formatRegionList.ts` | 수정 | `selectedRegionContent(groups: ToggleRegions[])` — 켜진 공고마다 인용 블록 한 줄, 0개 경고 (§2.9.5) |
| `providers/discord/builder/selectMenus/regionSelectMenus.ts` | 수정 | `regionGroupSelectMenu(sub.sources)`는 켜진 공고의 권역만, `regionGroupMenuContent`·`regionCityMenuContent` 단계 문구, 주석의 시·권역 수 (§2.6, §2.9.5) |
| `providers/discord/builder/disableMessageComponents.ts` | 수정 | `withDisabledComponents` — 잠금, 작업, 실패 시 복원을 한 함수로 (§2.9.7) |
| `events/listeners/buttons/subscribeAdd.ts` | 수정 | 구독 정보를 읽어 켜진 공고의 권역 메뉴를 그림, [⬅️ 뒤로], 지역 모드가 ALL이면 메뉴를 열지 않음 (§2.9.5) |
| `events/listeners/buttons/subscribeClear.ts` | 수정 | 화면에 보이는 지역만 지움, 지역 모드가 ALL이면 저장 안 함 (§2.9.5) |
| `events/listeners/selectMenus/onRegionGroupSelect.ts` | 수정 | 메뉴를 잠근 뒤 시 메뉴로 바꿈, [⬅️ 뒤로] (§2.9.5) |
| `providers/recruit/sourceToggle.ts` | 신규 | 공고 묶음 계산 (§2.9.5) |
| `providers/discord/builder/buttons/subscribeSettingsHubButtons.ts` | 신규 | [📍 지역 설정] [🌐 사이트 설정] [⬅️ 뒤로] |
| `providers/discord/builder/buttons/sourceToggleButtons.ts` | 신규 | 공고 켜기/끄기 버튼 |
| `features/alarmSubscribe/constants/sourceSelectAction.ts` | 신규 | `SOURCE_SELECT:OPEN`·`TOGGLE_KOREA`·`TOGGLE_ELIAS` |
| `features/alarmSubscribe/constants/subscribeOptionAction.ts` | 수정 | `REGION` 추가 |
| `features/alarmSubscribe/constants/index.ts`, `fullActionId.ts` | 수정 | 새 ID export·등록, `SourceSelectActionId` 타입 |
| `events/handlers/buttons/sourceSelectHandlers.ts` | 신규 | `SOURCE_SELECT:*` 핸들러 맵 |
| `events/handlers/buttons/index.ts`, `showSubscribeOptionHandler.ts` | 수정 | 새 맵 합치기, `SUBSCRIBE_OPTION:REGION` 등록 |
| `events/listeners/buttons/onShowRegionSettings.ts`, `onSourceSelectOpen.ts`, `onSourceToggle.ts` | 신규 | 버튼 핸들러 (§2.9.7 표) |
| `events/listeners/buttons/renderSourceSettings.ts` | 신규 | 사이트 설정 화면 (§2.9.5) |
| `events/listeners/buttons/renderSubscribeSettingsHub.ts` | 신규 | 설정 관리 화면 그리기 |
| `events/listeners/buttons/renderSubscribeManage.ts` | 수정 | `notice?` 인자, 지역 모드가 ALL이면 저장 대신 화면을 다시 그리는 `rerenderIfAllRegions` (§2.9.5) |
| `events/listeners/buttons/onShowSubscribeManage.ts:21` | 수정 | 설정 관리 화면으로 연결 |

**E. 2026-10-14 결정으로 추가되는 파일 (알림 스케줄러, 게시자, 정렬, 빈 목록)**

| 파일 | 변경 | 내용 |
|------|------|------|
| `services/notificationService.ts` | 수정 | `notifyNewRecruits` → `notifyRecruits(current, changedIds)`, `runNotification()` 추가, 생성자로 객체를 받고 `getNotificationService()`로 처음 쓸 때 생성 (§2.8.0) |
| `schedulers/jobs.ts` | 신규 | 예약 실행 작업 목록 `SCHEDULED_JOBS` (사이트 갱신 2개 + 알림) (§2.8.2) |
| `app/scheduler.ts` | 수정 | 손으로 쓴 `onSchedule` 2개와 로컬 1회 실행을 `SCHEDULED_JOBS`를 도는 코드로 바꿈 (§2.8.2) |
| `schedulers/utils/initializeSchedulers.ts` | 수정 | `RECRUIT_SOURCES` 대신 `SCHEDULED_JOBS`를 돌며 등록 (§2.8.2) |
| `schedulers/RecruitScheduler.ts`, `schedulers/factory.ts`, `schedulers/SchedulerManager.ts` | 수정 | 받은 `run`을 주기마다 실행하는 범용 스케줄러로 변경, `createScheduler(job)`, 레지스트리 키를 `functionName`으로 (§2.8.2) |
| `schedulers/utils/index.ts:1`, `schedulers/index.ts:7,10` | 수정 | `registerSchedulers`, `createScheduler` 내보내기 (§2.8.2) |
| `events/bus/handlers/NotificationEventHandler.ts`, `events/bus/utils/registerEventHandlers.ts:10,50` | 삭제·수정 | `RECRUIT_CHANGED` → 즉시 발송 연결 해제 (§2.8.2) |
| `services/recruitService.ts` | 수정 | `syncRecruits` 옵션(`skipIfSyncedWithinMs`·`waitForLock`), 마지막 갱신 시각 저장, 0건 처리 (§2.8.2, §2.12). `getRecruitList`가 Redis가 비면 `syncRecruits`를 부르고 Firestore는 읽기만 함, `collectAndSaveRecruits` 삭제 (§2.8.4). 생성자로 객체를 받을 수 있게 변경 (§2.8.0) |
| `services/recruitSourceService.ts` | 수정 | 사이트 설정 누락 시 빈 목록 대신 오류(`:44-47`, §2.12). `fetchAll`·`isRequestAllowed`와 `requestLimitStore`·`providers` 필드 삭제 (§2.8.4) |
| `providers/redis/store/requestLimitStore.ts`, `providers/redis/key/requestLimitKeyManager.ts` | 삭제 | 10분 제한 제거 (§2.8.4) |
| `providers/redis/store/index.ts:3`, `providers/redis/key/index.ts:2,6`, `providers/redis/constants/serviceName.ts:2` | 수정 | 위 삭제에 따른 등록 해제 |
| `providers/recruit/sria/sriaDisplay.ts`, `providers/recruit/elias/eliasDisplay.ts`, `common/utils/alarmFilter.ts` | 신규 | `toDisplay()` (§2.5), `selectedValues` (§2.1) |
| `services/recruitCacheService.ts` | 수정 | 비교값 계산을 `recruitHash.ts`로 옮김 (0건 목록은 지금 코드로도 "전부 삭제됨"으로 처리되므로 변경 없음) |
| `common/utils/recruitHash.ts` | 신규 | `hashRecruits` — 공고 비교값 계산 (§2.8.2) |
| `common/utils/recruitFilter.ts` | 수정 | `getStartDate`·`sortByStartDateDesc`·`getRecruitStatus`·`sortForNotification` (§2.7) |
| `providers/redis/store/notifiedHashStore.ts` | 신규 | 지난 알림 때 목록 `recruit:notified:all` (§2.8.2) |
| `providers/redis/key/recruitKeyManager.ts`, Redis store 레지스트리 | 수정 | 새 키 이름(`recruit:notified:all`, `recruit:lastSync:{source}`) 등록 |
| `common/constants/city.ts` | 수정 | elias 지역 `EliasRegions`, 권역 `eliasRegions` 추가 (§2.6) |
| `common/utils/cityName.ts:62` | 수정 | 지역 이름에 공백 허용 (§2.6) |
| `events/bus/__test__/EventBus.test.ts:44-52` | 수정 | sria 공고에 `postedBy` 추가. `__test__`도 빌드 대상이라 빠지면 컴파일 오류가 난다 |
| `providers/redis/manager/redisManager.ts:4,16,24` | 수정 | `setValue` 추가, `notifiedStore` 등록, `RequestLimitStore` 등록 해제 (§2.8.0, §2.8.2) |
| `providers/recruit/sria/sriaPostings.ts`, `sriaMockGenerator.ts` | 수정 | `postedBy` 값과 전달 (§2.5) |
| `providers/recruit/sria/sriaMockConfig.ts:16` | 수정 | 갱신 주기 240 → 120분 (§2.4) |

### 2.11 소스 이름 변경 (temp → elias)

**이유**: 이번 phase부터 구독 문서의 `sources.values`에 소스 값이 저장된다. 나중에 이름을 바꾸면 사용자 구독 문서까지 고쳐야 한다. 아직 배포 전이라 지금 바꾸면 고칠 데이터가 없다.

**범위 조사**: `functions/src`에서 `temp|Temp|TEMP`를 검색했다(21개 파일). 일반 단어(`attempt`·`temperature`)만 걸린 6개 파일은 뺐다: `ai/llm/client.ts`, `providers/discord/utils/dmSender.ts`, `common/utils/errorHandler.ts`, `common/utils/__test__/systemError.test.ts`, `providers/redis/client/connection.ts`, `providers/CLAUDE.md`. 남은 15개 파일이 대상이다.

**바꿔 쓰기 규칙**

| 기존 | 변경 |
|------|------|
| `RecruitSource` 값 `"temp"` | `"elias"` |
| `TempRecruit` | `EliasRecruit` |
| 폴더 `providers/recruit/temp/` | `providers/recruit/elias/` |
| `tempTitles`·`tempFields`·`tempConfig`·`generateTempRecruits` | `eliasTitles`·`eliasFields`·`eliasConfig`·`generateEliasRecruits` |
| `TempMockProvider`·`TempRuleConfig`·`TempConfig`·`TempField`·`TempValue` | `EliasMockProvider`·`EliasRuleConfig`·`EliasConfig`·`EliasField`·`EliasValue` |
| 배포 함수 이름 `recruitSchedule_temp` | `recruitSchedule_elias` |
| 공고 ID 앞부분 `temp:{s}-{idx}` | `elias:{s}-{idx}` |
| 주석·문서의 "temp" | "elias" |

**A. 폴더와 파일 이름 변경 (6개)** — `providers/recruit/temp/` → `providers/recruit/elias/`

| 기존 파일 | 새 파일 | 바뀌는 내용 |
|-----------|---------|------------|
| `TempMockProvider.ts` | `EliasMockProvider.ts` | 클래스 이름, `source = "elias"`, import (`:3,4,7,9,10,13`) |
| `tempRule.ts` | `eliasRule.ts` | 타입·함수 이름, 공고 ID 앞부분 (`:96`), `source` 값 (`:112`), 주석 (`:5,85`). 생성부 정리는 §2.6 |
| `tempMockConfig.ts` | `eliasMockConfig.ts` | `eliasConfig`·`EliasConfig`, import (`:1-3,6,10,14,21,22`). `editProb` 삭제는 §2.6 |
| `tempTitles.ts` | `eliasTitles.ts` | `eliasTitles`, 새 모양 `EliasTitle[]` (§2.6) |
| `tempFields.ts` | `eliasFields.ts` | `eliasFields`·`EliasField`·`EliasValue` (`:2,11,15,23,26`). 주석 예시의 `badge` 교체는 §2.6 |
| `README.md` | `README.md` | 폴더·파일·식별자 이름, 속성 안내 (§2.6) |

**B. 내용만 수정 (9개, 1단계 기준)**

| 파일:줄 | 바뀌는 내용 |
|---------|------------|
| `common/types/recruit.d.ts:6-7,17,35-37,42` | `RecruitSource`, `EliasRecruit`, 주석. 형식 정리는 §2.6 |
| `common/types/index.ts:15` | `EliasRecruit` export |
| `providers/recruit/index.ts:4,6,10,12,17,27,32` | import·export 경로와 이름, `SOURCE_CONFIGS` 키 (§2.4) |
| `app/scheduler.ts:43-52,59` | 배포 함수 `recruitSchedule_elias`, `getSourceConfig("elias")`. 9단계에서 `schedulers/jobs.ts`로 옮긴다(§2.8.2) |
| `schedulers/utils/initializeSchedulers.ts:7` | 소스 목록의 temp. 9단계에서 작업 목록으로 바꾼다(§2.8.2) |
| `app/index.ts:10` | 주석의 함수 이름 |
| `common/utils/systemError.ts:73` | 주석 |
| `providers/recruit/sria/sriaPostings.ts:7` | 주석 |
| `providers/discord/builder/embeds/jobLink.ts:5,19` | 주석 |

- 이번 설계에서 새로 만드는 `eliasDisplay.ts`(§2.5)와 테스트(§6)는 처음부터 elias 이름을 쓴다.
- `functions/src` 밖에서 옛 이름(`recruitSchedule_temp`·`TempRecruit`·`tempTitles`·`providers/recruit/temp`)이 나오는 문서: `.claude/docs/build-deploy.md`, `README.md`, `.claude/phases/phase-1-core.md`, `.claude/phases/phase-source-subscription.md`. 구현 순서의 문서 갱신 단계에서 함께 고친다.

**배포 함수 이름 변경**
- 배포된 적이 없으므로 Firebase에서 지울 옛 함수(`recruitSchedule_temp`)는 없다.
- 함수 이름이 바뀌면 Firebase는 다른 함수로 본다. 이미 배포한 뒤였다면 `firebase deploy`가 옛 함수 삭제를 묻는다.

**공고 ID 변경의 영향**
- 생성기의 난수는 공고 ID를 씨앗으로 쓴다(`tempRule.ts:101,107,122,128`). ID 앞부분이 바뀌면 같은 시각이라도 고르는 제목, 조기 마감 시점, `eliasFields` 값이 이전과 달라진다. 결정적으로 생성된다는 성질은 그대로다.
- Redis 키 이름에는 소스가 들어가지 않는다(`recruit:city:all`, `recruit:hash:city:all` — `providers/redis/key/recruitKeyManager.ts:15-16`). 소스는 두 키 안의 항목 이름(공고 ID) 앞부분으로만 구분된다.

**로컬 Redis에 남은 `temp:` 데이터 처리**
- 그대로 두면 지워지지 않는다. 소스별 비교는 `elias:`·`sria:`로 시작하는 항목만 보므로(`recruitCacheService.ts:50-55`) `temp:` 항목은 어느 소스의 "삭제됨"에도 잡히지 않는다. 두 키의 만료 시간도 매 회차 연장된다(`:94-97`).
- 남아 있으면 공고 조회 슬래시 커맨드에 옛 temp 공고가 나온다. 이 공고의 `source`는 `"temp"`라 새 `RecruitSource` 타입에 없는 값이다.
- 처리: 이름 변경 뒤 처음 로컬 실행하기 전에 공고 키, 지난 알림 때 목록 키, 마지막 갱신 시각 키를 지운다.
  ```
  redis-cli DEL recruit:city:all recruit:hash:city:all recruit:notified:all recruit:lastSync:sria recruit:lastSync:elias
  ```
  다음 회차에서 sria와 elias 모두 기준을 새로 저장한다. 지난 알림 때 목록도 없으므로 그 회차에는 알림이 나가지 않는다(§2.8.2). §6.2 로컬 2회 실행은 이 상태에서 시작한다.
- `temp:` 항목만 지우려면 `HKEYS`로 이름을 확인한 뒤 `HDEL`로 지운다. 지울 항목을 하나씩 적어야 하므로 키를 통째로 지우는 쪽을 권장한다.
- 마지막 갱신 시각도 함께 지우는 이유: 남아 있으면 "5분 안에 갱신함"으로 건너뛰어, 빈 목록이 정상 0건처럼 처리되어 지난 알림 때 목록과 Firestore 목록이 비워진다.
- 아직 배포 전이므로 배포 환경 Redis(Upstash)에는 처리할 `temp:` 데이터가 없다. 배포 전에 테스트로 스케줄러를 돌린 적이 있다면 같은 방법으로 지운다.

### 2.12 사이트 공고 0건 처리

**파일**: `services/recruitService.ts`, `services/recruitSourceService.ts`, `services/recruitCacheService.ts`

지금은 사이트 공고가 0건이면 저장을 건너뛴다(`recruitService.ts:106-108`). 그래서 공고가 정말 0건이 되어도 Redis에는 이전 공고가 남는다. elias도 드물지만 목록이 0건이 될 수 있다.

**변경**
- 0건이면 그 사이트 공고를 Redis에서 모두 지운다. 0건 목록도 `setRecruitList(list, source)`로 넘겨 비교하면, 기존 공고가 모두 "삭제됨"으로 잡혀 지워진다.
- 직전에 그 사이트 공고가 있었는데 0건이 되면 경고 로그를 남긴다: `syncRecruits(${source}): 공고 0건 — 이전 ${n}건을 지움`.
- 사이트 설정이 없을 때 빈 목록을 돌려주던 부분(`recruitSourceService.ts:44-47`)은 `SystemError.validationError`로 바꾼다. 그대로 두면 설정 실수로 그 사이트 공고가 전부 지워진다.

**상황별 결과**

| 상황 | 결과 |
|------|------|
| 사이트에서 가져오기 실패 | `provider.fetch()`가 예외를 던져(`recruitSourceService.ts:48`) Redis를 건드리지 않는다. 기존 공고는 최신 공고 목록 키가 만료될 때(6시간)까지 남는다 |
| 사이트 설정 누락 | 오류로 끝나고 공고를 지우지 않는다 |
| 정말 0건 | 그 사이트 공고를 지운다 |
| 사이트 코드 버그로 0건이 나옴 (설정 값 실수, 데이터 파일을 비움, 실제 사이트 화면 구조 변경) | 진짜 0건과 구분할 수 없어 지운다. 경고 로그로 원인을 찾는다 |

- 지금은 두 사이트 모두 mock 데이터다. 실제 사이트를 연결할 때는 화면 구조가 바뀌어 공고를 읽지 못하면 빈 목록 대신 예외를 던지도록 만든다.

- 0건이 된 다음 갱신은 그 사이트 비교 기준이 없어서 "기준만 저장"으로 처리된다(`recruitCacheService.ts:66-83`). 알림은 지난 알림 때 목록과 비교하므로(§2.8.2) 이 회차의 새 공고도 다음 알림에 나간다.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

| 컬렉션 | 문서 구조 | 용도 |
|--------|----------|------|
| `users/{userId}/notifications/settings` | `{ enabled: boolean, regions: {mode: "ALL" \| "SELECTED", values: CityEn[]}, sources: {mode: "ALL" \| "SELECTED", values: RecruitSource[]}, createdAt: Timestamp, updatedAt: Timestamp }` | 사용자 알림 구독. mode가 ALL이면 `values`는 읽을 때 무시한다(지역 모드만 바꿀 때 목록을 남기기 위해 저장은 유지). `alertMode`는 저장하지 않음. 옛 형식 `{alertMode, regions: CityEn[]}`은 읽을 때 변환 (§2.2) |

데이터 이전 작업은 하지 않는다. 옛 문서는 다음 쓰기(지역 변경 등) 때 새 형식으로 바뀐다.

### 3.2 이벤트 페이로드

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| `NOTIFICATION_SEND` | `{ userId, displays: RecruitDisplay[], settings: AlarmSubscription }` (변경) | 알림 스케줄러의 판정 ①~⑤ 후 1건 이상 남았을 때 |
| `NOTIFICATION_SENT` | 변경 없음. `jobCount`에 `displays.length` | DM 발송 직후 |
| `NOTIFICATION_SUBSCRIBE` | 변경 없음 (`settings`가 새 형식 `AlarmSubscription`). 현재 구독하는 핸들러 없음 | 구독·재구독 직후 |
| `RECRUIT_CHANGED` | 변경 없음 | 소스별 비교 결과 변경 있음. **더 이상 DM 발송으로 이어지지 않는다** (§2.8.2) |

### 3.3 Redis 키

| 키 | 모양 | 용도 | 만료 |
|----|------|------|------|
| `recruit:city:all` | 해시 (공고 ID → 공고 JSON) | 최신 공고 목록. 기존 | 6시간, 갱신마다 연장 (기존 동작) |
| `recruit:hash:city:all` | 해시 (공고 ID → 비교값) | 사이트 갱신의 변경 감지. 기존 | 6시간, 갱신마다 연장 (기존 동작) |
| `recruit:notified:all` | 해시 (공고 ID → 비교값). 목록이 비면 표시 항목 `__empty__` 하나만 있음 | 지난 알림 때 목록. 신규 (§2.8.2) | 없음 |
| `recruit:lastSync:{source}` | 문자열 (epoch ms) | 사이트별 마지막 갱신 성공 시각. 신규 (§2.8.2) | 1일 |
| `lock:recruit:sync:{source}` | 문자열 (락 토큰) | 사이트 갱신 락. 기존 (`recruitService.ts:96-98`) | 60초 |
| `lock:notification` | 문자열 (락 토큰) | 알림 락. 신규 (§2.8.2) | 5분 |

---

## 4. 구현 순서

이름 변경을 먼저 끝내 빌드가 통과하는 상태에서 다음 단계로 간다. 2단계에서 타입을 바꾸면 구독 형식·이벤트 데이터·embed 입력을 쓰는 곳이 모두 컴파일 오류가 나므로, **2단계부터 12단계까지는 빌드가 깨질 수 있다**. 1단계와 12단계 끝에서 `npm run build` 통과를 확인한다.

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | 소스 이름 변경 temp → elias (동작 변경 없이 이름만). `schedulers/jobs.ts`는 9단계에 만들므로, 이 단계에서는 `app/scheduler.ts:43-52,59`와 `initializeSchedulers.ts:7`의 temp를 직접 elias로 바꾼다. 끝나면 `npm run build` 통과 확인 | §2.11 A·B 15개 파일 | §2.11 |
| 2 | 구독·공고 타입(`postedBy` 포함), `selectedValues`, 기존 테스트의 공고 값 | `common/types/alarmSubscription.ts`, `common/types/recruit.d.ts`, `common/types/index.ts`, `common/utils/alarmFilter.ts`, `events/bus/__test__/EventBus.test.ts` | §2.1, §2.5, §2.6 |
| 3 | 저장 형식 (읽기 변환, 지역 모드만 변경, 필드 전체 교체 쓰기) | `providers/firebase/store/subscription.ts` | §2.2 |
| 4 | 구독 서비스 | `features/alarmSubscribe/services/subscriptionService.ts` | §2.3 |
| 5 | elias 지역 추가, elias 생성 규칙(기간 12시간, 생성·종료·제거 확률, 게시자, 연도 포함 기간, `editProb`·"급구" 삭제), 공고 목록, README 속성 안내 | `common/constants/city.ts`, `common/utils/cityName.ts`, `regionSelectMenus.ts`, `providers/recruit/elias/eliasRule.ts`, `eliasMockConfig.ts`, `eliasTitles.ts`, `eliasFields.ts`, `README.md` | §2.6 |
| 6 | sria `postedBy`·갱신 주기 120분, `SOURCE_CONFIGS` 표시 정보, `toDisplay()` | `sria/sriaPostings.ts`, `sriaMockGenerator.ts`, `sriaMockConfig.ts`, `providers/recruit/index.ts`, `sria/sriaDisplay.ts`, `elias/eliasDisplay.ts` | §2.4, §2.5 |
| 7 | 필터·정렬 (`getStartDate`, `sortByStartDateDesc`, `getRecruitStatus`, `sortForNotification`), 비교값 계산 분리 | `common/utils/recruitFilter.ts`, `common/utils/recruitHash.ts`, `services/recruitCacheService.ts` | §2.7, §2.8.2 |
| 8 | 사이트 갱신 옵션·마지막 갱신 시각·0건 처리, 사이트 설정 누락 오류, 공고 조회의 저장 경로 통일 | `services/recruitService.ts`, `services/recruitSourceService.ts`, `providers/redis/manager/redisManager.ts`, `providers/redis/key/recruitKeyManager.ts`, `requestLimitStore.ts`·`requestLimitKeyManager.ts` 삭제와 등록 해제 | §2.8.2, §2.8.4, §2.12, §3.3 |
| 9 | 이벤트 데이터, 판정·발송, 알림 스케줄러, 즉시 발송 연결 해제, 발송 핸들러, 알림 함수 등록 | `events/bus/types.ts`, `services/notificationService.ts`, `providers/redis/store/notifiedHashStore.ts`, `events/bus/handlers/NotificationEventHandler.ts` 삭제, `events/bus/utils/registerEventHandlers.ts:10,50`, `NotificationSendHandler.ts`, `schedulers/jobs.ts`, `app/scheduler.ts`, `schedulers/utils/initializeSchedulers.ts`, `schedulers/RecruitScheduler.ts`, `schedulers/factory.ts`, `schedulers/SchedulerManager.ts`, `schedulers/utils/index.ts`, `schedulers/index.ts` | §2.8 |
| 10 | UI 컴파일 수정 (바꿔 쓰기 규칙, 요약 문구) | §2.10 A-12~15, `subscriptionSummary.ts`, `subscribeEntryView.ts` | §2.9.1, §2.10 |
| 11 | 공고 목록 그리기(게시자 표시), DM embed(안내 문구), 공고 조회 커맨드(정렬) | `recruitList.ts`, `jobLink.ts`, `notificationMessageEmbed.ts`, `recruitMessageEmbed.ts`, `onRecruitRequest.ts` | §2.9.2~§2.9.4 |
| 12 | 사이트 설정 UI: ID 상수, 공고 묶음 계산과 켜기/끄기, 설정 관리 화면. 끝나면 `npm run build` 통과 확인 | §2.10 A-10·16·17, §2.10 D 나머지 | §2.9.5~§2.9.8 |
| 13 | 테스트 15종 (11종 + 런타임 검증 뒤 추가 4종) | §6 | §6 |
| 14 | 로컬 Redis 옛 데이터 삭제 → `npm run build`·`npm run lint`·로컬 2회 실행·UI 수동 확인 | — | §2.11, §6 |
| 15 | 문서 갱신 | §2.10 C, §2.11의 `functions/src` 밖 문서 | §2.10, §2.11 |

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger 사용 (console.log 금지 — 기존 `__test__` 파일의 출력은 예외)
- [ ] SystemError 패턴 준수 (`firestoreError`, `validationError`)
- [ ] EventBus 타입 안전 이벤트 (`emitEventAndSettle<NotificationSendEvent>`)
- [ ] JSDoc 주석 (public API: 필터 3종, `getRecruitStatus`, `getStartDate`, `sortByStartDateDesc`, `sortForNotification`, `hashRecruits`, `toDisplay`, `getUserFacingSources`, store 신규 메서드, `updateSources`, `notifyRecruits`, `runNotification`)
- [ ] 한국어 주석
- [ ] `common`은 `providers`를 import하지 않는다 (노출 소스는 인자로 전달)
- [ ] Firestore 쓰기에 `undefined` 값을 넣지 않는다 (ALL 필터도 `values` 배열을 넣는다)
- [ ] `functions/src`에 소스 이름 `temp`가 남지 않는다 (일반 단어 `attempt`·`temperature` 제외)

---

## 6. 테스트 계획

### 6.1 테스트 15종 (기존 `__test__` 방식)

1~11번은 처음 설계한 테스트다. 12~15번은 런타임 검증 뒤 바뀐 화면과 저장 방식을 확인하려고 더했다.

기존 방식(`events/bus/__test__/EventBus.test.ts:87`)처럼 테스트 함수를 export하고 `require.main === module`일 때 직접 실행한다. 실패하면 `process.exitCode = 1`을 설정해 종료 코드로 통과·실패를 판정한다.

- 실행: `cd functions && npm run build && node lib/<경로>.test.js`
- `ENV`가 모듈을 불러올 때 `REDIS_URL`을 요구하므로(`env.ts:26`), `providers/recruit`를 import하는 테스트는 첫 줄에 `import "dotenv/config";`를 둔다. Redis에 실제로 연결하지는 않는다.
- 테스트 데이터는 `test/mocks/multiSource.ts`(신규)에 sria·elias `Job` 생성 함수로 둔다. elias는 `generateEliasRecruits(고정 now, eliasConfig)`로 결정적으로 만든다.

| # | 파일 | 검증 항목 | 방법 | 기대 결과 |
|---|------|----------|------|----------|
| 1 | `services/__test__/recruitCacheService.multiSource.test.ts` | 소스별 변경 감지 분리 | 메모리 기반 가짜 `RecruitCacheStore`·`RecruitHashStore`로 `setRecruitList(sria, "sria")`, `setRecruitList(elias, "elias")` 기준선 저장 → elias 공고 1건의 `status`를 "종료"로 바꿔 다시 실행 → sria를 그대로 다시 실행 | elias 회차: 그 1건만 `updatedJobs`에 잡힘. sria 회차: `UNCHANGED`, sria 결과에 elias id 없음, `deletedIds`에 elias id 없음 |
| 2 | `providers/recruit/__test__/toDisplay.test.ts` | `toDisplay` 변환, elias 제목 생성 | sria·elias 공고를 `toDisplay`. elias 공고 제목 확인. sria `dDay: ""` 공고도 한 건 넣음 | sria: `period`에서 시간 제거, `status`=`recruitmentStatus`, `extraFields`=작성(`postedAt`이 있을 때)·마감(`dDay`가 ""이면 빠짐) 순서, `url` 유지. elias: `status` 그대로, `fields` → `extraFields` 그대로, `url` 없음, 제목이 `[한글 지역] 제목` 형식. 둘 다 `source`·`sourceLabel`(`"sria"`·`"elias"`)·`postedBy` 채워짐 |
| 3 | `common/utils/__test__/recruitFilter.test.ts` | 구독 조건 일치, 상태 읽기 | sria 2건(서울·부산)·elias 2건 목록에 `filterBySource`→`filterByRegion`. 따로 sria("접수중"·"발표중"·"종료")·elias("접수중"·"종료") 공고에 `getRecruitStatus` | sria만 / elias만 / 둘 다 / ALL 각각 기대 건수. 지역 SELECTED+0개는 0건. 지역 ALL은 소스 결과 그대로. 상태가 소스 필드 값 그대로 나옴 |
| 4 | `services/__test__/userFacing.test.ts` | 노출 여부 | ① `getUserFacingSources()` 호출 ② 숨긴 소스가 있는 경우를 흉내 내 `filterVisibleSources(jobs, {sria})` 후 소스 ALL 구독자·SELECTED [elias] 구독자 판정 | ① sria·elias 둘 다 들어 있음 ② elias 공고 0건 (숨긴 소스는 ALL 구독자에게도 가지 않음) |
| 5 | `providers/discord/builder/embeds/__test__/recruitList.test.ts` | 공고 목록 그리기 (§2.9.2) | 고정 `RecruitDisplay` 목록(sria 5건·elias 1건, `period`·`status`·`extraFields`·`url` 있음/없음 섞기)을 두 모드로 그림 | 두 모드 공통: 제목이 `[서울] …`이면 `[서울][접수중] …`, `[…]`로 시작하지 않는 제목은 맨 앞에 `[상태]`, `status`가 없으면 그대로. 간단히: 제목 줄과 `📅 기간` 줄, 게시자·`extraFields` 없음. 자세히: `📅 기간 \| 게시자 \| 추가 칸` 순서, "게시" 글자 없음, 상태 칸 없음, 빈 칸 생략, 칸이 없으면 둘째 줄 없음. 묶음 순서 sria → elias, 사이트마다 상위 3건. sria 꼬리줄 `이 외 2건` + 링크. elias(`url` 없음) 링크 없음. `hasOverflow` = true |
| 6 | `providers/recruit/__test__/eliasRule.test.ts` | elias 생성 규칙 (§2.6) | `generateEliasRecruits`를 고정 시작 시각부터 `unitMs` 간격으로 30일 이상 돌리며 공고 ID별로 결과를 모음. 결과를 실제 `RecruitCacheService`(메모리 저장소)에 연결해 회차별 변경 감지 결과도 모음 | 같은 ID의 `title`·`postedBy`·`period`·`fields`는 모든 시각에서 같음. `status`가 바뀐다면 "접수중" → "종료" 한 번뿐이고, 변경 감지의 `updatedJobs`는 이 경우만 잡힘(앞 공고가 제거된 회차에도 뒤 공고 값이 바뀌지 않음). 모집 기간 끝 이후에는 없음. 같은 회차 공고끼리 제목+게시자가 겹치지 않고, 3건이 뽑힌 회차도 2건만 만들어짐. 제목의 지역이 `요정 왕국`·`세계수 교단`이고 게시자가 지역과 같음. `period`는 `YYYY.MM.DD HH:mm ~ YYYY.MM.DD HH:mm` 모양이고 시작 값이 `s * unitMs`의 한국 시간과 같음. 같은 30분 안 다른 시각의 결과가 같음. 하루 생성 수·목록 평균이 §2.6 예상 범위 안(생성 30~45건, 평균 8~14건). "틱" 글자와 `badge` 칸이 없음 |
| 7 | `common/utils/__test__/recruitSort.test.ts` | 정렬 (§2.7) | sria(`dayTxt`)·elias(`period`) 공고를 날짜를 섞어 넣고 `sortByStartDateDesc`. 같은 날 다른 시각 2건, 같은 시각 2건, 형식이 틀린 기간 1건 포함 | 시작 시점 최신순. 같은 날이면 시각이 늦은 공고가 앞. 같은 시각은 넣은 순서 유지. 형식이 틀린 공고는 맨 뒤. 같은 목록에 상태를 섞어 `sortForNotification`: A(접수중, 10.11)·B(종료, 10.12)·C(접수중, 10.09)·D(발표중, 10.10) → A, C, D, B |
| 8 | `services/__test__/runNotification.test.ts` | 알림 스케줄러 (§2.8.2) | `new NotificationService(가짜 deps)`로 메모리 기반 가짜 저장소·락·구독자 목록을 넘기고 `NOTIFICATION_SEND` 수집. 모든 경우의 실행 전에 가짜 저장소의 마지막 갱신 시각을 지워 다시 갱신이 건너뛰어지지 않게 한다. ① 지난 알림 때 목록 없이 실행 ② 공고 1건 추가 후 실행 ③ 락을 미리 잡아 두고 실행 ④ 구독자 목록 읽기에서 예외를 낸 뒤 다시 실행 ⑤ 사이트 락을 미리 잡아 두고, 2초 뒤 마지막 갱신 시각을 지금으로 저장하고 락을 푼다 ⑥ ⑤와 같되 마지막 갱신 시각을 저장하지 않고 락만 푼다(앞 갱신 실패) ⑦ 공고 1건의 상태를 "종료"로 바꾼 뒤 실행 ⑧ 서울 구독자·부산 구독자를 두고 부산 공고 1건만 추가한 뒤 실행 ⑨ 구독자 2명 중 1명의 발송 핸들러가 오류를 내게 하고 공고 1건 추가 후 실행 ⑩ 최신 공고 목록을 비우고 모든 사이트 가져오기가 실패하게 한 뒤 실행 ⑪ 모든 사이트가 정상으로 0건을 돌려주게 한 뒤 실행하고, 공고 1건을 추가해 한 번 더 실행 ⑫ 한 사이트 가져오기만 실패하게 하고 공고 1건 추가 후 실행 ⑬ 사이트 락을 2초 잡아 둔 채 다른 사이트 가져오기 시작 시각을 기록 ⑭ `RecruitService`에 `lockWaitMs: 10_000`을 넘기고, 최신 공고 목록을 비운 뒤 모든 사이트 락을 풀지 않아 대기 시간을 넘기게 하고 실행 | ① 발송 0건, 목록 저장됨 ② 조건이 맞는 구독자에게 추가 공고와 기존 공고가 함께 발송됨 ③ 발송 0건(건너뜀) ④ 목록이 저장되지 않아 다음 실행에서 다시 발송됨 ⑤ 그 사이트 가져오기 0회 ⑥ 그 사이트 가져오기 1회 ⑦ 발송됨. "종료" 공고가 목록 맨 뒤 ⑧ 부산 구독자만 발송 ⑨ 다른 1명은 발송됨, 지난 알림 때 목록은 저장됨 ⑩ 발송 0건, 지난 알림 때 목록과 Firestore 목록이 그대로 ⑪ 첫 실행에서 지난 알림 때 목록과 Firestore 목록이 비워지고, 다음 실행은 첫 실행으로 처리되지 않아 추가 공고가 발송됨 ⑫ 추가 공고가 발송됨 ⑬ 다른 사이트가 기다리지 않고 바로 시작됨 ⑭ 발송 0건, 지난 알림 때 목록과 Firestore 목록이 그대로. ①②⑦⑧⑨는 가짜 `RecruitStore.saveRecruitList`가 최신 공고 목록으로 1번 불림, 이 저장이 실패하도록 해도 알림은 정상 종료. 모든 경우 실행 뒤 알림 락이 풀려 있음(③ 제외). 반환값은 ②⑦⑧⑨⑫와 ④의 다시 실행, ⑪의 둘째 실행의 발송 시도 인원과 같고, 나머지는 0. 발송 시도 인원에는 DM이 실패한 구독자도 들어간다. ⑨는 핸들러가 비동기로 실패하면 2, 이벤트 발행에서 동기 예외가 나면 1이다 |
| 9 | `app/__test__/scheduledJobs.test.ts` | 작업 목록과 내보낸 함수 (§2.8.2 스케줄 등록) | 빌드한 `lib/app/scheduler.js`를 불러와 내보낸 이름과 각 함수의 `__endpoint`를 읽음(실행하지 않음). `registerSchedulers()`의 레지스트리 키도 모음(시작하지 않음) | 둘 다 `SCHEDULED_JOBS`의 `functionName`(`recruitSchedule_sria`·`recruitSchedule_elias`·`notificationScheduler`)과 같음. 각 함수의 일정·시간대·제한 시간이 목록 값과 같음. 알림 일정은 `0 6-20/2 * * *`, 시간대는 `Asia/Seoul` |
| 10 | `services/__test__/getRecruitList.test.ts` | 공고 조회의 읽기 경로 (§2.8.4) | `new RecruitService(가짜 deps)`로 메모리 기반 가짜 저장소·락, 가짜 `recruitSource`(`fetchBySource`), 가짜 `RecruitStore`를 넘김. 경우마다 새 저장소로 시작한다. ① Redis에 목록이 있을 때 ② Redis가 비었을 때 ③ ②에서 elias 사이트 락을 미리 잡아 두고 2초 뒤 푼다 ④ ②에서 사이트 가져오기가 모두 실패하고 Firestore에 목록이 있을 때 ⑤ ④에서 Firestore도 비었을 때 | ① `tier: "redis"`, 사이트 가져오기 0회 ② `tier: "source"`, 사이트마다 1회씩 가져옴, Redis에 sria·elias 공고가 사이트별로 저장되고 마지막 갱신 시각이 남음 ③ elias는 락이 풀린 뒤 결과를 씀(락 대기) ④ `tier: "firestore"`, Redis에 쓰지 않음 ⑤ `tier: "empty"`. 어느 경우에도 `saveRecruitList`가 불리지 않음 |
| 11 | `providers/redis/store/__test__/notifiedHashStore.test.ts` | 지난 알림 때 목록 저장 (§2.8.2) | 메모리 기반 가짜 Redis 클라이언트(`hGetAll`, `multi`)로 실제 저장소 코드를 실행. ① 키 없이 `getAll` ② 빈 객체로 `clearAndSaveHashes` 후 `getAll` ③ 공고 2건 저장 후 1건으로 저장 ④ `multi` 안의 저장 실패 | ① `null` ② `{}` (`__empty__`가 보이지 않음) ③ 1건만 남음 ④ 기존 값이 그대로 남음 |
| 12 | `providers/recruit/__test__/sourceToggle.test.ts` | 공고 묶음 계산 (§2.9.5) | 저장값을 바꿔 가며 `sourceToggle.ts`와 요약·안내 함수를 직접 부름 | 묶음과 권역이 겹치지 않음. 하나를 끄면 SELECTED, 다시 켜면 ALL. 마지막 묶음은 끌 수 없음. 지역 메뉴·알림 판정·화면 표시가 켜진 공고 기준. 꺼진 공고의 지역은 저장값에 남음. 표시는 묶음 순서와 가나다순. 개수 제한은 공고별 |
| 13 | `events/listeners/selectMenus/__test__/onRegionGroupSelect.test.ts` | 권역 선택 뒤 화면 교체 (§2.9.5) | 권역 메뉴가 달린 가짜 인터랙션으로 실제 핸들러를 실행하고 응답 순서를 기록 | `update`로 권역 메뉴를 잠근 뒤 `editReply`로 시 메뉴와 [⬅️ 뒤로]로 바꿈. 뒤로 버튼 3곳이 §2.9.5 표의 화면으로 감 |
| 14 | `providers/discord/builder/__test__/disableMessageComponents.test.ts` | 잠금과 복원 (§2.9.7) | 실제 버튼 빌더로 만든 메시지에서 `withDisabledComponents`를 성공·실패 경우로 실행 | 성공하면 잠금 응답만 보냄. 작업이나 화면 그리기가 실패하면 버튼과 원래 이름을 되돌리고 원래 예외를 다시 던짐. 잠금이 실패하면 작업을 시작하지 않음 |
| 15 | `events/listeners/selectMenus/__test__/regionSave.test.ts` | 지역 저장 핸들러 3개 (§2.9.5) | 구독 조회와 `updateRegions`만 가짜로 바꾸고 추가·제거·초기화 핸들러를 실행 | 지역 모드가 ALL이면 셋 다 저장하지 않고 안내 문구와 함께 지역 화면을 다시 그림. 추가·제거 버튼도 메뉴를 열지 않고 같은 화면을 그림. 일반 공고 지역이 2개면 더 추가하지 않고, elias 지역은 따로 세어 추가됨. 초기화는 꺼진 공고의 지역을 남김 |

### 6.2 정적·로컬 검증

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 컴파일 | `cd functions && npm run build` | 오류 0 |
| 알림 스케줄러 | 로컬 1회 실행을 두 번: 1회차(기준·지난 알림 때 목록 저장) → `sriaPostings.ts`에 공고 1건 추가 후 빌드 → 2회차 | 1회차 `NOTIFICATION_SEND` 0건. 2회차 추가 공고의 조건이 맞는 구독자에게만 발송되고, DM에는 구독 조건에 맞는 공고 전체가 접수 중 먼저 최신순으로 들어 있음. DM 한 통에 sria·elias가 함께 묶임. DM 맨 아래 안내 문구 보임 |
| 알림 중복 실행 | 2회차를 터미널 두 개에서 동시에 실행 | 한쪽만 발송, 다른 쪽은 "알림이 이미 실행 중" 경고 |
| 사이트 공고 0건 | `sriaPostings.ts`를 빈 목록으로 바꿔 실행 | Redis에서 sria 공고가 모두 지워지고 경고 로그가 남음. elias 공고는 그대로 |
| lint | `cd functions && npm run lint` | 오류 0 |
| 옛 구독 문서 호환 | `sources` 없는 옛 형식 문서를 가진 계정으로 로컬 2회 실행 | `sources: {mode:"ALL"}`로 읽혀 sria·elias 공고 모두 수신 |
| 로컬 2회 실행 | 로컬 Redis의 키 삭제(§2.11 명령) → `RUN_SCHEDULER_ONCE=true node lib/app/scheduler.js` 1회차(기준 저장) → `recruit:notified:all`에서 공고 1건 삭제(`HDEL`) → 2회차 | 소스·지역 조건이 맞는 구독자에게만 `NOTIFICATION_SEND` 로그 |
| 구독자별 오류 격리 | 2회 실행 중 형식이 잘못된 테스트 문서 1개 포함 | 경고 로그 후 나머지 구독자 발송 계속 |
| "변경됨"·"종료" 발송 | 1회차 뒤 `sriaPostings.ts`에서 공고 A의 `dDay`를, 공고 B의 `recruitmentStatus`를 "종료"로 바꾸고 다시 빌드 → 2회차 | A·B 모두 지난 알림 때 목록과 비교값이 달라짐. A나 B의 조건이 맞는 구독자에게 `NOTIFICATION_SEND`. B는 목록에서 접수 중 공고 뒤에 있음 |
| elias 기간 고정 | 로컬 2회 실행 사이에 조기 마감된 elias 공고가 없을 때 | elias `updatedJobs` 0건 (지금처럼 매번 모든 elias 공고가 "변경됨"이 되지 않음) |
| elias 지역 | 지역 추가에서 `elias 지역` → 요정 왕국을 고르고 실행 | 메뉴에 `elias 지역`이 보이고, 요정 왕국 공고가 발송됨. 서울만 고른 구독자에게는 elias 공고가 가지 않음 |
| 기존 기능 | 알림 설정 UI(모드 전환, 지역 추가·삭제·초기화, 끄기·켜기) | 정상 동작, 저장 문서에 `alertMode` 없음 |
| 모드 전환 후 지역 복원 | 지역 2개 선택 → 전체 모드로 전환 → 선택 모드로 다시 전환. 옛 형식 문서로도 한 번 반복 | 처음 고른 지역 2개가 그대로 보임. 전체 모드일 때는 모든 지역 공고 수신 |
| 첫 구독 | 문서 없는 계정으로 [알림 켜기] → [모든 지역] / [지역 선택] 각각 | 사이트 질문 없이 `sources: {mode:"SELECTED", values:["sria"]}`로 저장되고 요약이 `🌐 일반 공고`. 지역 추가 메뉴에 `elias 지역`이 없음. 모든 지역은 진입 화면, 지역 선택은 지역 화면으로 감 |
| 공고 켜기/끄기 | [⚙️ 설정 관리] → [🌐 사이트 설정]에서 elias 끄기 → 한국 끄기 시도 → elias 켜고 한국 끄기 | 켜진 묶음이 하나면 버튼이 잠김. 저장값이 §2.9.5 표대로 바뀜. 요약 줄이 켜진 공고 이름으로 바뀜 |
| 공고에 따른 지역 메뉴 | elias만 켠 상태와 한국만 켠 상태에서 지역 추가 | 켜진 공고의 권역만 보임. 꺼진 공고의 지역은 화면에서 빠지고, 다시 켜면 돌아옴. [📍 지역 설정] → [⬅️ 뒤로]가 설정 관리 화면으로 돌아감 |
| 지역 개수 제한 | 일반 공고 지역 2개를 고른 뒤 일반 지역과 elias 지역을 하나씩 더 추가 | 일반 지역은 `대한민국 지역은 최대 2개까지 선택할 수 있어요.`로 거절되고, elias 지역은 추가됨. 두 공고가 모두 차면 [➕ 추가]가 잠김 |
| 지역 초기화 | 두 공고에 지역을 고른 뒤 elias를 끄고 [🧹 초기화] → elias를 다시 켬 | 초기화 뒤 화면에는 지역이 없고, elias를 켜면 elias 지역이 그대로 돌아옴 |
| 뒤로 버튼 | 권역 메뉴, 시 메뉴, 지역 제거 메뉴에서 각각 [⬅️ 뒤로] | 권역·제거 메뉴는 지역 화면으로, 시 메뉴는 권역 메뉴로 감 |
| 옛 메시지에서 지역 편집 | 지역 선택 상태에서 지역 화면을 연 채로 둔다 → 새로 연 화면에서 모든 지역으로 바꾼다 → 옛 화면에서 [➕ 추가]·[➖ 제거]·[🧹 초기화]를 각각 누름. 옛 화면에 추가·제거 메뉴를 열어 둔 경우도 메뉴에서 지역을 고름 | 저장값이 ALL 그대로이고, 첫 클릭에 옛 화면이 안내 문구와 함께 모든 지역 화면으로 바뀜 |
| Redis `multi()` | 로컬 Redis와 Upstash에서 알림을 한 번 실행하고 `HGETALL recruit:notified:all` | 두 환경 모두 지난 알림 때 목록이 저장됨 |
| 공고 조회 커맨드 | 공고 조회 슬래시 커맨드를 지역 없이·지역 지정(`서울`, `요정 왕국`)으로 실행 | 사이트별 묶음, 자세히 모드. 제목이 `[지역][상태] …` 모양이고 "종료" 공고도 `[종료]`로 나옴. 둘째 줄에 상태 칸이 없음. elias 기간이 `2026.10.11 14:00 ~ 2026.10.12 02:00` 모양이고 "틱" 글자가 없음. 게시자가 기간 뒤 칸에 "게시" 글자 없이 보임. `postedAt`을 적은 sria 공고에만 `작성 …` 칸이 보임. 시작 시점(시각이 있으면 시각까지) 최신순이고 "종료" 공고도 그 순서대로 섞여 나옴. elias 항목에 마감 칸이 없음. 링크는 sria에만 |

---

*작성일: 2026-10-10 · 수정일: 2026-11-05*
*참고: docs/phase-1-15/01-plan.md, .claude/phases/phase-source-subscription.md*

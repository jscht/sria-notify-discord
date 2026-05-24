# Phase 1.4 설계서: phase-1-4-notification-store

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-4/01-plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Common Types (`functions/src/common/types/`) | **신규** `alarmSubscription.ts` — canonical `AlertMode` const 객체, `AlarmSubscription`, `AlarmSubscriptionInput`. `index.ts`에 export 추가 |
| Providers Firebase (`functions/src/providers/firebase/`) | **신규** `store/subscription.ts` — `SubscriptionStore` 클래스. `constants/collections.ts`에 `USERS`, `NOTIFICATIONS` 추가. `store/index.ts`에 `SubscriptionStore` export |
| Events Bus (`functions/src/events/bus/`) | `types.ts`의 `AlertMode`/`AlarmSubscription` 중복 정의 제거 → `@/common/types`에서 import |
| Features alarmSubscribe (`functions/src/features/alarmSubscribe/`) | enum `AlertModeSelectAction` 폐기, `alertModeSelectActionId` 빌더가 `AlertMode` 참조. `SubscribeCommand`을 `AlertMode` 별칭으로 변경. `types/alarmSubscription.ts` 파일 삭제. `services/subscriptionService.ts` 시그니처만 정합화 |
| Events Listeners (`functions/src/events/listeners/`) | 버튼/커맨드 리스너 4건의 enum 멤버 및 리터럴 `"SELECTED_REGIONS"` 사용처 갱신 |
| Providers Discord Builder (`functions/src/providers/discord/builder/`) | `commands/slash/alarmSubscribe.ts` choice value 갱신 |

### 1.2 컴포넌트 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│ common/types/alarmSubscription.ts (SoT)                              │
│   AlertMode (const object) → typeof AlertMode[keyof typeof AlertMode]│
│   AlarmSubscription, AlarmSubscriptionInput                          │
└─────────────────────────────────────────────────────────────────────┘
            │                  │                       │
            │ (import type)    │ (import value+type)   │ (import type)
            ▼                  ▼                       ▼
┌──────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────┐
│ events/bus/types.ts  │ │ features/alarmSubscribe │ │ providers/firebase/ │
│  (NotificationSubscr │ │  /constants             │ │  store/subscription │
│   ibeEvent.settings, │ │  /types                 │ │  (SubscriptionStore)│
│   NotificationSend   │ │  /services              │ │                     │
│   Event.settings)    │ │  /commands /ai          │ │   ↓ db.collection   │
└──────────────────────┘ └─────────────────────────┘ │   ↓ users/{uid}/    │
            │                     │                  │     notifications/  │
            │                     │ (customId,       │     settings        │
            │                     │  choice value)   └─────────────────────┘
            │                     ▼
            │            ┌────────────────────────────┐
            │            │ events/listeners (buttons/ │
            │            │  commands), providers/     │
            │            │  discord/builder           │
            │            │  └→ Discord UI customId,   │
            │            │     slash choice value     │
            │            └────────────────────────────┘
            │
            └─── (Phase 1.5/1.7/2.2 후속 — subscriptionService → SubscriptionStore)
```

**핵심 흐름**:
1. `AlertMode` 값 한 곳에서 정의 → 모든 컴파일·런타임 참조처가 자동 갱신
2. `SubscriptionStore`만이 Firestore `Timestamp` ↔ `number` 변환 책임
3. EventBus 페이로드의 `settings: AlarmSubscription`은 canonical 타입을 그대로 참조 (이중 정의 0건)

---

## 2. 상세 설계

### 2.1 신규 canonical 도메인 타입

**파일**: `functions/src/common/types/alarmSubscription.ts` (신규, `.ts` — 런타임 값 export 필요)

**인터페이스/타입 정의**:
```typescript
import type { CityEn } from "./city.d";

/**
 * 알림 모드 — 값과 타입의 단일 진실 공급원
 *
 * `as const` 객체 + 파생 union type 패턴:
 * - 값 변경 시 한 줄 수정으로 전 사용처 자동 갱신
 * - `AlertMode.SELECTED` 형태로 타입스크립트 enum과 유사하게 사용
 * - 트리쉐이킹 가능, 별도 enum 메타데이터 없음
 */
export const AlertMode = {
  ALL: "ALL",
  SELECTED: "SELECTED",
} as const;
export type AlertMode = typeof AlertMode[keyof typeof AlertMode];

/**
 * 사용자 알림 구독 정보 (canonical)
 *
 * Firestore 문서: `users/{userId}/notifications/settings`
 * timestamps는 ms 단위 number (애플리케이션 경계). Firestore Timestamp 변환은 SubscriptionStore가 담당.
 */
export interface AlarmSubscription {
  userId: string;
  enabled: boolean;
  alertMode: AlertMode;
  regions: CityEn[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 생성/업데이트 입력값
 * userId, createdAt, updatedAt은 store가 채움
 */
export type AlarmSubscriptionInput = Pick<
  AlarmSubscription,
  "enabled" | "alertMode" | "regions"
>;
```

**`common/types/index.ts` 추가 export**:
```typescript
// Alarm Subscription Types
export { AlertMode } from "./alarmSubscription";
export type { AlarmSubscription, AlarmSubscriptionInput } from "./alarmSubscription";
```

**에러 처리**: 타입 정의 파일이므로 런타임 에러 없음.

---

### 2.2 EventBus 중복 정의 제거

**파일**: `functions/src/events/bus/types.ts`

**변경**: L100-112 (`AlertMode` 타입, `AlarmSubscription` 인터페이스 정의) 제거. `Job`/`JobDiffResult` 와 동일하게 `@/common/types`에서 type import.

```typescript
// L7-9 (기존 import 블록 확장)
import type { Job, JobDiffResult } from "@/common/types/job.d";
import type { CityEn } from "@/common/types/city.d";
import type { AlertMode, AlarmSubscription } from "@/common/types";
import type { CRAWL_MODE } from "@/common/constants";
import type { RecruitData } from "@/crawlers/types";

// L97-112 (Notification Domain 페이로드 섹션)
/**
 * Notification Domain 이벤트 페이로드
 *
 * AlertMode, AlarmSubscription은 @/common/types에서 재사용 (SoT)
 */

// 알림 구독 이벤트
export interface NotificationSubscribeEvent extends BaseEvent {
  userId: string;
  settings: AlarmSubscription;
}
// ... (이하 그대로)
```

**에러 처리**: 컴파일 단계 검증. `tsc --noEmit`로 차단.

---

### 2.3 alarmSubscribe enum 폐기 + customId 빌더 갱신

**파일**: `functions/src/features/alarmSubscribe/constants/alertModeSelectAction.ts`

```typescript
import { AlertMode } from "@/common/types";

export const ALERT_MODE_SELECT_PREFIX = "ALERT_MODE" as const;

/**
 * 알림 모드 선택 버튼의 customId 매핑
 *
 * `AlertMode` 상수 객체를 직접 참조하여 도메인-UI 값 일관성 보장.
 * 결과 customId:
 *   - alertModeSelectActionId.ALL      = "ALERT_MODE:ALL"
 *   - alertModeSelectActionId.SELECTED = "ALERT_MODE:SELECTED"
 */
export const alertModeSelectActionId = {
  ALL: `${ALERT_MODE_SELECT_PREFIX}:${AlertMode.ALL}`,
  SELECTED: `${ALERT_MODE_SELECT_PREFIX}:${AlertMode.SELECTED}`,
} as const;
```

**파일**: `functions/src/features/alarmSubscribe/constants/index.ts`

`AlertModeSelectAction` re-export 라인 제거 (정의 자체가 삭제됨).

**파일**: `functions/src/features/alarmSubscribe/types/alarmSubscribeCommand.ts`

```typescript
import { AlertMode } from "@/common/types";
import { fullActionId, RegionEditActionId } from "../constants/fullActionId";

/**
 * @deprecated 새 코드는 `AlertMode`를 직접 사용. 기존 호출자 호환을 위해 별칭 유지.
 */
export type SubscribeCommand = AlertMode;

/**
 * 구독 모드별 허용되는 액션 매핑
 * - ALL 모드: 추가, 초기화만 가능
 * - SELECTED 모드: 추가, 삭제, 초기화 모두 가능
 */
type CommandActionMap = {
  ALL: Extract<
    RegionEditActionId,
    typeof fullActionId.REGION_EDIT_ADD | typeof fullActionId.REGION_EDIT_CLEAR
  >;
  SELECTED: RegionEditActionId;
};

/** 구독 모드에 따라 허용되는 액션 타입 */
export type AlarmSubscribeAction<C extends AlertMode> = CommandActionMap[C];
```

**파일**: `functions/src/features/alarmSubscribe/types/alarmSubscription.ts` → **삭제**

**파일**: `functions/src/features/alarmSubscribe/types/index.ts`

```typescript
// 기존: export type { AlarmSubscription, AlarmSubscriptionInput } from "./alarmSubscription";
export type { AlarmSubscription, AlarmSubscriptionInput } from "@/common/types";
```

**에러 처리**: 컴파일 시 enum 멤버 사용처 8건 일제 에러 → §2.4에서 모두 갱신.

---

### 2.4 enum/리터럴 사용처 일괄 갱신 (8건)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `events/listeners/buttons/onChangeConfirm.ts:10` | `=== AlertModeSelectAction.SELECTED` → `=== AlertMode.SELECTED` (import 라인 교체) |
| 2 | `events/listeners/buttons/onEnableSelectedRegionAlert.ts:27` | `AlertModeSelectAction.SELECTED` → `AlertMode.SELECTED` |
| 3 | `events/listeners/buttons/onShowSubscribeManage.ts:21` | 동일 |
| 4 | `events/listeners/buttons/subscribeRemove.ts:41` | 리터럴 `"SELECTED_REGIONS"` → `AlertMode.SELECTED` |
| 5 | `events/listeners/commands/onAlarmSubscribe.ts:14` | JSDoc 주석에서 `AlertModeSelectAction.SELECTED("SELECTED_REGIONS")` 표기 제거 → `AlertMode.SELECTED` |
| 6 | `providers/discord/builder/commands/slash/alarmSubscribe.ts:10` | `value: AlertModeSelectAction.SELECTED` → `value: AlertMode.SELECTED` (import 라인 교체) |
| 7 | `features/alarmSubscribe/commands/slashCommand.ts:9` | 리터럴 `"SELECTED_REGIONS"` → `AlertMode.SELECTED` |
| 8 | `features/alarmSubscribe/ai/interpreter.ts:12` | `mode?: "ALL" \| "SELECTED_REGIONS"` → `mode?: AlertMode` (import 추가) |

**참고 사용처 (JSDoc/주석만)**:
- `features/alarmSubscribe/constants/fullActionId.ts:51` — 주석 표기 갱신

**`subscriptionService.ts` 시그니처 정합화** (본문 TODO 유지):
```typescript
import type { AlarmSubscription, AlarmSubscriptionInput, AlertMode, CityEn } from "@/common/types";

export class AlarmSubscriptionService {
  async getUserAlertMode(userId: string): Promise<AlertMode | null> { /* TODO Phase 1.5 */ return null; }
  async subscribe(userId: string, input: AlarmSubscriptionInput): Promise<AlarmSubscription> { /* TODO Phase 1.5 */ throw new Error("Not implemented"); }
  async unsubscribe(userId: string): Promise<void> { /* TODO Phase 1.5 */ }
  async updateMode(userId: string, alertMode: AlertMode): Promise<AlarmSubscription> { /* TODO Phase 1.5 */ throw new Error("Not implemented"); }
  async updateRegions(userId: string, regions: CityEn[]): Promise<AlarmSubscription> { /* TODO Phase 1.5 */ throw new Error("Not implemented"); }
  async getSubscription(userId: string): Promise<AlarmSubscription | null> { /* TODO Phase 1.5 */ return null; }
}
```

**에러 처리**: 각 사용처는 단순 import 교체 + 식별자 변경. 런타임 의미 변화 없음.

---

### 2.5 SubscriptionStore 클래스

**파일**: `functions/src/providers/firebase/store/subscription.ts` (신규)

**인터페이스/타입 정의**:
```typescript
import "@/common/utils/systemLogger";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import type {
  AlarmSubscription,
  AlarmSubscriptionInput,
  AlertMode,
  CityEn,
} from "@/common/types";
import { providerLogger } from "@/common/utils/systemLogger";
import { FirebaseCollection } from "../constants/collections";

const SETTINGS_DOC_ID = "settings";

export class SubscriptionStore {
  private readonly db = getFirestore();

  constructor() {}

  private getSettingsRef(userId: string) {
    return this.db
      .collection(FirebaseCollection.USERS).doc(userId)
      .collection(FirebaseCollection.NOTIFICATIONS).doc(SETTINGS_DOC_ID);
  }

  async getNotificationSettings(userId: string): Promise<AlarmSubscription | null>;
  async setNotificationSettings(userId: string, input: AlarmSubscriptionInput): Promise<void>;
  async updateAlertMode(userId: string, alertMode: AlertMode): Promise<void>;
  async updateAlertRegions(userId: string, regions: CityEn[]): Promise<void>;
  async toggleNotificationEnabled(userId: string, enabled: boolean): Promise<void>;
  async getAllActiveSubscribers(): Promise<AlarmSubscription[]>;
}
```

**핵심 로직** (pseudo-code):

```typescript
// Firestore Timestamp/number 변환 헬퍼 (모듈 private)
function toAlarmSubscription(userId: string, data: FirebaseFirestore.DocumentData): AlarmSubscription {
  return {
    userId,
    enabled: data.enabled,
    alertMode: data.alertMode,
    regions: data.regions ?? [],
    createdAt: (data.createdAt as Timestamp).toMillis(),
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
  };
}

async getNotificationSettings(userId: string): Promise<AlarmSubscription | null> {
  const snap = await this.getSettingsRef(userId).get();
  if (!snap.exists) return null;
  return toAlarmSubscription(userId, snap.data()!);
}

// 쓰기 전용(CQS) — 저장 후 상태가 필요하면 호출자가 getNotificationSettings 호출.
async setNotificationSettings(userId: string, input: AlarmSubscriptionInput): Promise<void> {
  const ref = this.getSettingsRef(userId);
  const now = Timestamp.now();
  const snap = await ref.get();

  const docData = snap.exists
    ? { ...input, updatedAt: now }                       // 기존: createdAt 보존, updatedAt만 갱신
    : { ...input, createdAt: now, updatedAt: now };      // 신규: 두 timestamp 모두 now

  await ref.set(docData, { merge: true });
  providerLogger.info("Notification settings saved", { userId, alertMode: input.alertMode });
}

// 부분 업데이트는 update() 사용 — 문서 없으면 NOT_FOUND throw.
// set(merge:true)의 upsert가 createdAt 누락 문서를 만드는 것을 차단하여
// "문서 생성은 setNotificationSettings만" 계약(아래 에러 처리)을 런타임에 강제.
async updateAlertMode(userId: string, alertMode: AlertMode): Promise<void> {
  await this.getSettingsRef(userId).update({ alertMode, updatedAt: Timestamp.now() });
}

async updateAlertRegions(userId: string, regions: CityEn[]): Promise<void> {
  await this.getSettingsRef(userId).update({ regions, updatedAt: Timestamp.now() });
}

async toggleNotificationEnabled(userId: string, enabled: boolean): Promise<void> {
  await this.getSettingsRef(userId).update({ enabled, updatedAt: Timestamp.now() });
}

async getAllActiveSubscribers(): Promise<AlarmSubscription[]> {
  const snapshot = await this.db
    .collectionGroup(FirebaseCollection.NOTIFICATIONS)
    .where("enabled", "==", true)
    .get();

  return snapshot.docs
    .filter(doc => doc.id === SETTINGS_DOC_ID)   // settings 문서만 (안전장치)
    .map(doc => {
      const userId = doc.ref.parent.parent!.id;  // users/{userId}/notifications/settings
      return toAlarmSubscription(userId, doc.data());
    });
}
```

**에러 처리**:
- Firestore 작업 실패 시 throw 전파 (호출자가 SystemError 패턴으로 변환). Phase 1.4 store 계층은 raw error 통과.
- `getNotificationSettings`은 문서 없음을 정상 흐름으로 처리 (`null` 반환).
- 기본값 자동 생성 안 함 — 명시적 `setNotificationSettings` 호출이 있어야 문서 생성.
- 부분 업데이트 3종은 `update()` 사용 — 문서 미존재 시 NOT_FOUND throw로 위 "자동 생성 안 함" 계약을 강제. (Phase 1.4 분석 이슈 #1 반영, 2026-05-24. 초안 pseudo-code의 `set(merge:true)`는 이 계약과 모순되어 정정됨)

---

### 2.6 컬렉션 enum 확장

**파일**: `functions/src/providers/firebase/constants/collections.ts`

```typescript
export enum FirebaseCollection {
  CONNECTION = "connection",
  RECRUIT = "recruit",
  PROXY = "proxy",
  USERS = "users",
  NOTIFICATIONS = "notifications",
}
```

**`providers/firebase/store/index.ts`**:
```typescript
export { ProxyStore } from "./proxy";
export { RecruitStore } from "./recruit";
export { ConnectionStore } from "./connection";
export { SubscriptionStore } from "./subscription";
```

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

| 컬렉션 | 문서 ID | 문서 구조 | 용도 |
|--------|---------|----------|------|
| `users/{userId}/notifications` (서브컬렉션) | `settings` (고정) | `{ enabled: boolean, alertMode: "ALL" \| "SELECTED", regions: CityEn[], createdAt: Timestamp, updatedAt: Timestamp }` | 사용자별 알림 설정 1건 |

**collectionGroup 쿼리**: `db.collectionGroup("notifications").where("enabled","==",true)` — 모든 사용자의 `settings` 문서 중 활성 구독자만 반환. `enabled` 단일 필드 인덱스는 Firestore 자동 생성.

**`firestore.indexes.json` 변경 없음**: 복합 인덱스 불필요. 향후 `orderBy("updatedAt")` 등 추가 시 검토.

**타임스탬프 정책**:
- 저장: `Timestamp.now()` (firebase-admin SDK)
- 조회: store 메서드가 `Timestamp.toMillis()`로 변환 → 애플리케이션은 항상 `number` ms

### 3.2 이벤트 페이로드

Phase 1.4 범위 내 이벤트 발행 없음. 기존 정의된 이벤트의 `settings` 필드 타입만 canonical 타입을 참조.

| 이벤트 타입 | 페이로드 (변경점) | 발행 시점 |
|------------|------------------|----------|
| `NOTIFICATION_SUBSCRIBE` | `settings: AlarmSubscription` (정의 위치만 변경, 형상 동일) | Phase 1.5 (UI 핸들러) |
| `NOTIFICATION_SEND` | `settings: AlarmSubscription` (정의 위치만 변경) | Phase 1.7 (자동 알림) |
| `NOTIFICATION_UNSUBSCRIBE` | 변경 없음 | Phase 1.5 |

---

## 4. 구현 순서

쓰기 작업 의존 그래프상 신규 SoT 파일을 먼저 만들고, 그 다음 import 경로/enum 사용처 정리, 마지막에 store 구현 순으로 진행. enum 제거 단계에서 컴파일 에러가 발생하지만 §2.4의 8건을 한 트랜잭션으로 처리하면 다시 그린 상태가 됨.

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | canonical 도메인 타입 신설 | `common/types/alarmSubscription.ts` (신규) + `common/types/index.ts` (export 추가) | §2.1 |
| 2 | EventBus 중복 정의 제거 | `events/bus/types.ts` (import 추가, L100-112 삭제) | §2.2 |
| 3 | features alarmSubscribe 타입 통합 | `features/alarmSubscribe/types/alarmSubscription.ts` (삭제), `types/index.ts` (재export 경로 변경) | §2.3 |
| 4 | enum 제거 + customId 빌더 갱신 | `features/alarmSubscribe/constants/alertModeSelectAction.ts`, `constants/index.ts`, `types/alarmSubscribeCommand.ts` | §2.3 |
| 5 | enum 멤버/리터럴 사용처 8건 갱신 (이 시점까지 컴파일 에러 → 5 완료 후 그린) | §2.4 표의 8개 파일 | §2.4 |
| 6 | subscriptionService 시그니처 정합화 | `features/alarmSubscribe/services/subscriptionService.ts` | §2.4 |
| 7 | TypeScript 컴파일 검증 (1차) | — | §6 항목 1 |
| 8 | `FirebaseCollection` enum 확장 | `providers/firebase/constants/collections.ts` | §2.6 |
| 9 | `SubscriptionStore` 클래스 구현 | `providers/firebase/store/subscription.ts` (신규) | §2.5 |
| 10 | store 모듈 export 추가 | `providers/firebase/store/index.ts` | §2.6 |
| 11 | TypeScript 컴파일 검증 (2차, 최종) | — | §6 항목 1 |
| 12 | Discord Slash Command 재등록 | `cd functions && npm run register:commands` | §6 항목 3 |
| 13 | 수동 검증 (Firebase Emulator/dev) | — | §6 항목 4~5 |

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입 — `SubscriptionStore`, `AlarmSubscription`, `getNotificationSettings`
- [ ] SystemLogger 사용 (`providerLogger`) — `console.*` 직접 호출 금지
- [ ] SystemError 패턴 — Phase 1.4 store는 raw throw, Phase 1.5 서비스 계층에서 변환 (범위 외)
- [ ] EventBus 타입 안전 이벤트 — 본 Phase에서 신규 이벤트 발행 없음, 기존 페이로드 타입만 canonical 참조
- [ ] JSDoc 주석 (public API) — `SubscriptionStore` 모든 public 메서드, `AlertMode`/`AlarmSubscription` 인터페이스
- [ ] 한국어 주석 (도메인 설명) + 영문 식별자
- [ ] `import type` 사용 (타입 전용 import — `AlarmSubscription` 등)
- [ ] `as const` 패턴 일관 (`AlertMode`, `alertModeSelectActionId`)

---

## 6. 테스트 계획

Phase 3 테스트 프레임워크 도입 전이므로 컴파일 검증 + 수동 검증으로 갈음.

| # | 검증 항목 | 방법 | 기대 결과 |
|---|----------|------|----------|
| 1 | 신규 타입 컴파일 | `cd functions && npx tsc --noEmit` | 신규 에러 0건 (기존 에러 수 유지) |
| 2 | 단일화 grep 검증 | (a) `grep -rn "interface AlarmSubscription" functions/src` (b) `grep -rn "AlertModeSelectAction" functions/src` (c) `grep -rn "SELECTED_REGIONS" functions/src` | (a) `common/types/alarmSubscription.ts` 1건만 (b) 0건 (c) 0건 |
| 3 | Discord Slash Command 재등록 | `cd functions && npm run register:commands` | 에러 없음, `/alarm-subscribe` 선택지 정상 표시 |
| 4 | Firestore round-trip (수동 — 에뮬레이터 또는 dev) | `setNotificationSettings("test-uid", {enabled:true, alertMode:"SELECTED", regions:["seoul"]})` → `getNotificationSettings("test-uid")` | 입력값 그대로 반환, `createdAt`/`updatedAt`이 `typeof === "number"` |
| 5 | collectionGroup 쿼리 동작 | `enabled:false` 1명 + `enabled:true` 2명 생성 후 `getAllActiveSubscribers()` | 2명 반환, `userId`가 부모 doc id와 일치 |
| 6 | 부분 업데이트 동작 | `setNotificationSettings` 후 `updateAlertMode("test-uid","ALL")` → `getNotificationSettings` | `alertMode==="ALL"`, `regions`/`enabled`은 이전 값 유지, `updatedAt` 갱신, `createdAt` 보존 |
| 7 | 값 변경 안정성 데모 (선택) | `AlertMode.SELECTED = "SELECTED_V2"` 일시 수정 → `tsc --noEmit` + customId 결과 확인 → 원복 | 컴파일 통과, `alertModeSelectActionId.SELECTED === "ALERT_MODE:SELECTED_V2"`로 자동 갱신 |
| 8 | 기존 기능 회귀 | Phase 1.3 RecruitCacheService 이벤트 발행 동작 (수동 트리거) | RECRUIT_NEW 이벤트 정상 발행 |

---

*작성일: 2026-05-13*
*참고: docs/phase-1-4/01-plan.md*

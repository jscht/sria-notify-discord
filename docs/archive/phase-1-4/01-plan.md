# Phase 1.4: phase-1-4-notification-store

**상태**: 🔄 진행 중
**우선순위**: P0 (⭐⭐⭐)
**의존성**: Firebase Admin SDK 초기화 완료 (`providers/firebase/initFirebaseApp.ts`)

---

## 개요

### 배경

`users/{userId}/notifications/settings` Firestore 저장소가 부재하여 알림 구독 정보를 영속화할 수 없는 상태. Phase 1.5(설정 UI)와 Phase 1.7(자동 알림)이 이 저장소에 의존하므로 선행 구현이 필요.

또한 사전 코드 조사에서 `AlarmSubscription` 도메인 타입이 **두 위치에 서로 다른 모양으로 중복 정의**되어 있음이 확인됨. 저장소 구현에 앞서 타입을 단일화하지 않으면 Phase 1.5/1.7에서 동일 Firestore 문서를 다르게 해석하는 정확성 버그가 100% 발생.

| 항목 | A: `events/bus/types.ts:102-112` | B: `features/alarmSubscribe/types/alarmSubscription.ts:3-12` |
|------|----------------------------------|-------------------------------------------------------------|
| 모드 필드명 | `alertMode` | `mode` |
| 모드 값 | `"ALL" \| "SELECTED"` | `AlertModeSelectAction.ALL("ALL") \| .SELECTED("SELECTED_REGIONS")` |
| regions | `CityEn[]` 필수 | `string[]` 선택 |
| `enabled` | ✅ | ❌ |
| timestamps | `number` (ms) | `Date` |

추가로 `AlertModeSelectAction.SELECTED = "SELECTED_REGIONS"` enum 값이 UI 버튼 customId(`ALERT_MODE:SELECTED_REGIONS`)에 묶여 있어 도메인-UI 값 불일치까지 존재.

### 목표

1. `AlarmSubscription` 도메인 타입을 **`common/types/`로 단일화** (`as const` 객체 + 파생 union type 패턴).
2. 기존 `AlertModeSelectAction` enum 폐기, UI customId 빌더는 신규 `AlertMode` 상수 객체 참조.
3. `providers/firebase/store/subscription.ts` (`SubscriptionStore` 클래스) 구현으로 알림 설정 CRUD 제공.
4. `getAllActiveSubscribers()` 쿼리 제공 → Phase 1.7 자동 알림 발송 기반 마련.

### 범위

| 포함 | 제외 |
|------|------|
| `common/types/alarmSubscription.ts` 신규 도메인 타입 | Phase 1.5 UI 핸들러 구현 (별도 Phase) |
| EventBus/features 중복 정의 제거 | `subscriptionService.ts` 메서드 본문 구현 (시그니처만 정합화) |
| `AlertModeSelectAction` enum → `AlertMode` const 객체 전환 | `NOTIFICATION_SUBSCRIBE`/`UNSUBSCRIBE` 이벤트 발행 로직 |
| `SubscriptionStore` 클래스 6개 메서드 구현 | Firestore Emulator 자동화 테스트 (수동 검증으로 갈음) |
| `users` / `notifications` 컬렉션 enum 추가 | 보안 규칙(`firestore.rules`) 신규 작성 |
| Discord Slash Command 재등록 (`npm run register:commands`) | 기존 Discord 메시지 customId 마이그레이션 |

---

## 요구사항

### 기능 요구사항

1. **신규 canonical 도메인 타입** — `functions/src/common/types/alarmSubscription.ts`
   - `AlertMode` `as const` 객체 + 파생 union (`"ALL" | "SELECTED"`)
   - `AlarmSubscription` 인터페이스: `userId/enabled/alertMode/regions/createdAt/updatedAt`
   - `AlarmSubscriptionInput`: `Pick<..., "enabled"|"alertMode"|"regions">`
   - `common/types/index.ts`에서 모두 export

2. **타입 중복 제거**
   - `events/bus/types.ts`의 `AlertMode`, `AlarmSubscription` 정의 삭제 → `@/common/types`에서 import
   - `features/alarmSubscribe/types/alarmSubscription.ts` 파일 삭제
   - `features/alarmSubscribe/types/index.ts`의 re-export 경로를 `@/common/types`로 변경

3. **enum → const 객체 전환**
   - `features/alarmSubscribe/constants/alertModeSelectAction.ts`: `AlertModeSelectAction` enum 제거
   - `alertModeSelectActionId` 빌더는 `AlertMode.ALL` / `AlertMode.SELECTED` 참조로 변경 (결과: `"ALERT_MODE:ALL"`, `"ALERT_MODE:SELECTED"`)
   - `features/alarmSubscribe/constants/index.ts`의 `AlertModeSelectAction` export 제거
   - `features/alarmSubscribe/types/alarmSubscribeCommand.ts`: `SubscribeCommand`을 `AlertMode` 별칭으로 변경, `CommandActionMap` 키를 리터럴(`ALL`/`SELECTED`)로 변경
   - enum 멤버/리터럴 사용처 8건 갱신 (`AlertModeSelectAction.SELECTED` → `AlertMode.SELECTED`, `"SELECTED_REGIONS"` → `AlertMode.SELECTED`)

4. **`SubscriptionStore` 클래스 구현** — `functions/src/providers/firebase/store/subscription.ts`
   - `getNotificationSettings(userId)`: 문서 없으면 `null` 반환 (자동 생성 X)
   - `setNotificationSettings(userId, input)`: 신규/덮어쓰기. `createdAt`은 신규일 때만, `updatedAt`은 매번 갱신
   - `updateAlertMode(userId, alertMode)`: 부분 업데이트
   - `updateAlertRegions(userId, regions)`: 부분 업데이트 (`CityEn[]`)
   - `toggleNotificationEnabled(userId, enabled)`: 부분 업데이트
   - `getAllActiveSubscribers()`: `collectionGroup('notifications')` + `where('enabled','==',true)` → `AlarmSubscription[]`
   - Firestore `Timestamp` ↔ `number` 변환은 store 경계에서만 수행 (애플리케이션은 `number`만 인지)
   - `ProxyStore` 패턴(`providers/firebase/store/proxy.ts:6-46`) 준수: `private readonly db = getFirestore()`, private ref getter

5. **컬렉션 enum 확장** — `providers/firebase/constants/collections.ts`
   - `USERS = "users"`, `NOTIFICATIONS = "notifications"` 추가

6. **Store 모듈 export** — `providers/firebase/store/index.ts`
   - `export { SubscriptionStore } from "./subscription"` 추가

7. **`subscriptionService.ts` 시그니처 정합화** (본문은 Phase 1.5)
   - `mode: SubscribeCommand` → `alertMode: AlertMode`
   - `regions?: string[]` → `regions: CityEn[]`
   - import 경로를 `@/common/types`로

8. **Discord Slash Command 재등록**
   - `cd functions && npm run register:commands` 1회 실행
   - `alarm-subscribe` choice value 및 button customId 갱신 확인

### 비기능 요구사항

- **성능**: `getAllActiveSubscribers()`는 collectionGroup 쿼리 1회로 처리. `enabled` 단일 필드 인덱스는 Firestore 자동 생성으로 충분.
- **호환성**: 기존 `AlarmSubscriptionService` (TODO 미구현 상태) 사용처는 시그니처만 정합화하고 본문은 미구현 유지 (Phase 1.5 작업). 컴파일 통과 필수.
- **에러 처리**: Firestore 작업 실패 시 호출자가 처리하도록 throw 전파. SystemError 패턴은 Phase 1.5 서비스 계층에서 도입.
- **로깅**: `SubscriptionStore` 메서드에서 `providerLogger` 사용 (기존 `ProxyStore`와 동일 패턴).
- **타입 안전성**: `npx tsc --noEmit` 신규 에러 0건.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore (firebase-admin SDK) |
| Messaging | discord.js |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger (providerLogger 프리셋) |

---

## 구현 전략

### 접근 방식

1. **타입 단일화를 선행**: 모든 사용처가 동일한 `AlarmSubscription` 형태를 보장해야 저장소 정확성이 성립. 도메인 타입을 `common/types/`로 옮기고 `as const` 패턴으로 enum 잉여를 제거.
2. **저장소 패턴 일관**: 신규 `SubscriptionStore`는 `ProxyStore`/`RecruitStore` 클래스 구조를 그대로 따름. private `db = getFirestore()`, private ref getter, public CRUD.
3. **경계 변환**: Firestore `Timestamp` ↔ JS `number` 변환은 store 경계 한 곳에서만 수행. 외부 코드는 항상 `number` ms 타임스탬프만 인지.
4. **부수 변경 최소화**: `subscriptionService.ts`는 시그니처만 정합화하고 본문 TODO 유지 → Phase 1.5에서 store 호출 로직 구현.

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `functions/src/common/types/alarmSubscription.ts` | 신규 | canonical `AlertMode` + `AlarmSubscription` + `AlarmSubscriptionInput` |
| `functions/src/common/types/index.ts` | 수정 | 위 3개 export 추가 |
| `functions/src/events/bus/types.ts` | 수정 | L100-112 중복 정의 제거 → common에서 import |
| `functions/src/features/alarmSubscribe/types/alarmSubscription.ts` | 삭제 | canonical로 흡수 |
| `functions/src/features/alarmSubscribe/types/index.ts` | 수정 | re-export 경로 `@/common/types`로 |
| `functions/src/features/alarmSubscribe/constants/alertModeSelectAction.ts` | 수정 | enum 제거, `alertModeSelectActionId` 빌더 갱신 |
| `functions/src/features/alarmSubscribe/constants/index.ts` | 수정 | `AlertModeSelectAction` export 제거 |
| `functions/src/features/alarmSubscribe/types/alarmSubscribeCommand.ts` | 수정 | `SubscribeCommand = AlertMode`, `CommandActionMap` 키 리터럴화 |
| `functions/src/features/alarmSubscribe/services/subscriptionService.ts` | 수정 | 시그니처만 정합화 (본문 TODO 유지) |
| `functions/src/features/alarmSubscribe/commands/slashCommand.ts` | 수정 | L9 리터럴 → `AlertMode.SELECTED` |
| `functions/src/features/alarmSubscribe/ai/interpreter.ts` | 수정 | L12 `mode?: "..."` → `mode?: AlertMode` |
| `functions/src/features/alarmSubscribe/constants/fullActionId.ts` | 수정 | L51 JSDoc 주석 갱신 |
| `functions/src/events/listeners/buttons/onChangeConfirm.ts` | 수정 | L10 enum 멤버 → `AlertMode.SELECTED` |
| `functions/src/events/listeners/buttons/onEnableSelectedRegionAlert.ts` | 수정 | L27 동일 |
| `functions/src/events/listeners/buttons/onShowSubscribeManage.ts` | 수정 | L21 동일 |
| `functions/src/events/listeners/buttons/subscribeRemove.ts` | 수정 | L41 리터럴 → `AlertMode.SELECTED` |
| `functions/src/events/listeners/commands/onAlarmSubscribe.ts` | 수정 | L14 JSDoc 주석 갱신 |
| `functions/src/providers/discord/builder/commands/slash/alarmSubscribe.ts` | 수정 | L10 enum 멤버 → `AlertMode.SELECTED` |
| `functions/src/providers/firebase/constants/collections.ts` | 수정 | `USERS`, `NOTIFICATIONS` 추가 |
| `functions/src/providers/firebase/store/subscription.ts` | 신규 | `SubscriptionStore` 클래스 |
| `functions/src/providers/firebase/store/index.ts` | 수정 | `SubscriptionStore` export |

### 의존성 분석

**선행 모듈** (이미 존재):
- `providers/firebase/initFirebaseApp.ts:18-26` — Firebase Admin 초기화
- `providers/firebase/store/proxy.ts:6-46` — 저장소 클래스 패턴 레퍼런스
- `common/types/city.d.ts` — `CityEn` 타입
- `common/utils/systemLogger.ts` — `providerLogger` 프리셋

**후속 의존 Phase**:
- Phase 1.5 (`phase-1-5-notification-settings-ui`): `SubscriptionStore` 인스턴스를 `subscriptionService`에서 호출하여 알림 설정 UI 핸들러 구현
- Phase 1.7 (`phase-1-7-auto-notification-system`): `getAllActiveSubscribers()`를 호출해 `RECRUIT_NEW` 이벤트 수신 시 활성 구독자에게 DM 발송
- Phase 2.2 (`phase-2-2-admin-broadcast`): `getAllActiveSubscribers()`로 공지 대상자 조회

---

## 성공 기준

- [ ] `interface AlarmSubscription` 정의가 `common/types/alarmSubscription.ts` 한 곳만 존재 (grep 검증 0건)
- [ ] `AlertModeSelectAction` 정의 잔존 0건
- [ ] 리터럴 `"SELECTED_REGIONS"` 잔존 0건 (주석 포함)
- [ ] TypeScript 컴파일 성공 — `cd functions && npx tsc --noEmit` 신규 에러 0건
- [ ] `SubscriptionStore` 6개 메서드 구현 완료
- [ ] `providers/firebase/store/index.ts`에서 `SubscriptionStore` export 가능
- [ ] `FirebaseCollection`에 `USERS`, `NOTIFICATIONS` 멤버 존재
- [ ] Firestore 수동 테스트 통과 (set → get round-trip, getAllActiveSubscribers 필터링)
- [ ] `npm run register:commands` 실행 성공 후 Discord `/alarm-subscribe` 명령어 정상 동작
- [ ] 기존 기능 회귀 0건 (Phase 1.3 RecruitCacheService 이벤트 발행 등)

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| `AlertModeSelectAction.SELECTED = "SELECTED_REGIONS"` 값 변경으로 인한 Discord 버튼 customId 변경 | 중 | 작업 후 `npm run register:commands` 즉시 실행. 진행 중인 ephemeral 메시지는 사용자가 명령어 재실행으로 해소. |
| `subscriptionService.ts` TODO 미구현 상태를 유지하여 Phase 1.5 작업까지 사용 불가 | 낮 | Phase 1.5 범위로 명시됨. 시그니처 정합화만으로 컴파일은 통과. |
| `getAllActiveSubscribers()`의 collectionGroup 쿼리가 대규모 사용자에서 비용 증가 | 낮 | 단일 필드 인덱스 자동 생성. 향후 사용자 수 증가 시 페이지네이션/배치 처리 검토. |
| Firestore `Timestamp` ↔ `number` 변환 누락으로 페이로드 직렬화 깨짐 | 중 | store 메서드 모두에서 변환 일관성 검증 (Verification §5 round-trip). |
| 타입 통합 작업으로 인한 컴파일 회귀 (사용처 누락) | 중 | grep으로 `AlertModeSelectAction`, `"SELECTED_REGIONS"` 잔재 0건 확인. `tsc --noEmit`으로 차단. |

---

## 후속 단계

이 plan 승인 후 `/pdca design 1.4` → 설계서 작성. 상세 절차/순서/구현 가이드는 본 문서가 아닌 설계서(02-design.md)에서 다룸.

---

*작성일: 2026-05-13*
*시드: .claude/phases/phase-1-core.md (Phase 1.4 섹션)*
*기반 플랜: C:\Users\user\.claude\plans\phase-1-4-inherited-rain.md*

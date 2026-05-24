# Phase 1.4 갭 분석: phase-1-4-notification-store

**상태**: 🔍 검토 중
**분석일**: 2026-05-24
**설계서**: `docs/phase-1-4/02-design.md`

---

## 1. 갭 분석 (Gap Detector)

설계(02-design.md §1~§6) ↔ 구현 전수 비교. 차원별 가중치: Structural ×0.2, Functional ×0.4, Contract ×0.4.

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | `common/types/alarmSubscription.ts` 신규 (§2.1, §4-1) | 신규 생성됨 | ✅ | `common/types/alarmSubscription.ts` |
| S2 | `common/types/index.ts` export 추가 (§2.1) | AlertMode(value) + 타입 2종 export | ✅ | `common/types/index.ts:19-20` |
| S3 | `events/bus/types.ts` 중복 정의 제거 (§2.2, §4-2) | L100-112 정의 삭제, import 전환 | ✅ | `events/bus/types.ts:9` |
| S4 | `features/.../types/alarmSubscription.ts` 삭제 (§2.3, §4-3) | 파일 부재 확인 (Glob 0건) | ✅ | (삭제됨) |
| S5 | `features/.../types/index.ts` re-export 경로 변경 (§2.3) | `@/common/types`로 변경 | ✅ | `features/alarmSubscribe/types/index.ts:9` |
| S6 | `constants/alertModeSelectAction.ts` enum 제거 (§2.3, §4-4) | enum 삭제, 빌더만 잔존 | ✅ | `constants/alertModeSelectAction.ts` |
| S7 | `constants/index.ts` AlertModeSelectAction export 제거 (§2.3) | export 라인 부재 | ✅ | `constants/index.ts:7-9` |
| S8 | `providers/firebase/store/subscription.ts` 신규 (§2.5, §4-9) | SubscriptionStore 클래스 신규 | ✅ | `providers/firebase/store/subscription.ts` |
| S9 | `providers/firebase/store/index.ts` export 추가 (§2.6, §4-10) | SubscriptionStore export 추가 | ✅ | `providers/firebase/store/index.ts:4` |
| S10 | `collections.ts` USERS/NOTIFICATIONS 추가 (§2.6, §4-8) | 두 멤버 추가됨 | ✅ | `providers/firebase/constants/collections.ts:5-6` |
| S11 | enum/리터럴 사용처 8건 + JSDoc 1건 갱신 (§2.4, §4-5) | 8개 파일 모두 수정됨 | ✅ | §2.4 표 8개 파일 |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | `getNotificationSettings` — 없으면 null, 자동생성 X (§2.5) | `!snap.exists → null`, 변환 후 반환 | ✅ | `subscription.ts:52-56` |
| F2 | `setNotificationSettings` — 신규/덮어쓰기, createdAt 신규만·updatedAt 매번 (§2.5) | `snap.exists` 분기로 createdAt 보존, set(merge:true) | ✅ | `subscription.ts:63-84` |
| F3 | `updateAlertMode` — 부분 업데이트 (§2.5) | `{alertMode, updatedAt}` merge | ✅ | `subscription.ts:89-94` |
| F4 | `updateAlertRegions(CityEn[])` — 부분 업데이트 (§2.5) | `{regions, updatedAt}` merge | ✅ | `subscription.ts:99-104` |
| F5 | `toggleNotificationEnabled` — 부분 업데이트 (§2.5) | `{enabled, updatedAt}` merge | ✅ | `subscription.ts:109-114` |
| F6 | `getAllActiveSubscribers` — collectionGroup + enabled==true + settings 필터 + userId 추출 (§2.5, §3.1) | 설계 pseudo-code와 동일 | ✅ | `subscription.ts:120-132` |
| F7 | Timestamp ↔ number 변환을 store 경계에서만 (§2.1, §3.1) | `toAlarmSubscription` 헬퍼가 `toMillis()` 단독 수행 | ✅ | `subscription.ts:18-30` |
| F8 | `getSettingsRef`: `users/{uid}/notifications/settings` 경로 (§2.5, §3.1) | 경로 정확, SETTINGS_DOC_ID="settings" | ✅ | `subscription.ts:43-47` |
| F9 | ProxyStore 패턴 준수 (§2.5, §5) | 동일 패턴, providerLogger 사용 | ✅ | `subscription.ts:39-47,76` |
| F10 | AlertMode 형상 — `{ALL,SELECTED} as const` + 파생 union (§2.1) | 설계와 동일 | ✅ | `alarmSubscription.ts:11-15` |
| F11 | AlarmSubscription 형상 6필드, timestamps number (§2.1) | 6필드 모두 일치 | ✅ | `alarmSubscription.ts:24-31` |
| F12 | AlarmSubscriptionInput — Pick<enabled\|alertMode\|regions> (§2.1) | 정확히 일치 | ✅ | `alarmSubscription.ts:37-40` |
| F13 | customId 빌더 결과 `ALERT_MODE:ALL`/`ALERT_MODE:SELECTED` (§2.3) | `${PREFIX}:${AlertMode.X}` 템플릿 → 일치 | ✅ | `alertModeSelectAction.ts:13-16` |
| F14 | slash choice value = `AlertMode.ALL`/`.SELECTED` (§2.4-6) | 두 빌더 파일 모두 적용 | ✅ | `discord/.../slash/alarmSubscribe.ts:9-10`, `commands/slashCommand.ts:9-10` |

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | `interface AlarmSubscription` 1곳만 (§6-2a) | grep 1건 (common/types) | ✅ | `common/types/alarmSubscription.ts:24` |
| C2 | `AlertModeSelectAction` 잔존 0건 (§6-2b) | grep 0건 | ✅ | — |
| C3 | 리터럴 `"SELECTED_REGIONS"` 0건 (§6-2c) | grep 0건 | ✅ | — |
| C4 | 모든 import 경로 `@/common/types` 통일 (§2.2~2.5) | 전 사용처 통일, 구 경로 import 0건 | ✅ | 다수 |
| C5 | EventBus `settings: AlarmSubscription` canonical 참조 (§2.2, §3.2) | type import 전환, 이중 정의 0건 | ✅ | `events/bus/types.ts:9,107,119` |
| C6 | `SubscribeCommand = AlertMode` 별칭, `CommandActionMap` 키 리터럴화 (§2.3) | 일치 | ✅ | `types/alarmSubscribeCommand.ts:10,17-23` |
| C7 | subscriptionService 시그니처 정합화, 본문 TODO 유지 (§2.4, plan 7) | 6개 시그니처 §2.4와 동일, 본문 미구현(의도된 범위) | ✅ | `services/subscriptionService.ts:1-57` |
| C8 | `SubscriptionStore` public 메서드 6개 시그니처 일치 (§2.5) | 6개 시그니처(반환타입 포함) 정확히 일치 | ✅ | `subscription.ts:52-132` |
| C9 | `FirebaseCollection`에 USERS/NOTIFICATIONS 멤버 (§2.6) | 멤버 존재, 값 `"users"`/`"notifications"` | ✅ | `collections.ts:5-6` |
| C10 | interpreter `mode?: AlertMode` (§2.4-8) | 리터럴 union 제거, AlertMode type import | ✅ | `ai/interpreter.ts:2,13` |
| C11 | fullActionId.ts JSDoc 갱신 (§2.4 참고) | L51 주석이 새 값 반영 | ✅ | `constants/fullActionId.ts:51` |
| C12 | `tsc --noEmit` 신규 에러 0건 (§6-1) | exit 0 | ✅ | — |

> 참고: 설계 §2.2 예시는 `import type { AlertMode, AlarmSubscription }`이나, 구현은 실제 사용되는 `AlarmSubscription`만 import(`AlertMode`는 주석에만 등장). 미사용 import 제거 = 컨벤션 준수 개선이며 계약 위반 아님 → ✅.

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 11/11 | 100% |
| Functional (×0.4) | 14/14 | 100% |
| Contract (×0.4) | 12/12 | 100% |
| **종합 매치율** | | **100.0%** |

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
            = 100×0.2 + 100×0.4 + 100×0.4 = 100.0%
```
부분일치 0건.

---

## 3. 갭 목록

### 3.1 미구현 항목

🔴 Critical 갭 **없음.** 설계 §1~§6 전 항목이 구현에 완전 반영됨.

### 3.2 설계 차이

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | §2.2: `import type { AlertMode, AlarmSubscription }` | `AlarmSubscription`만 import | 허용 (미사용 import 제거, 컨벤션 개선) |
| 2 | §2.5 pseudo-code: 부분 업데이트 `set(merge:true)` | `update()` 사용 | 정정 — 설계 §2.5 "자동 생성 안 함" 명시 계약과 pseudo-code가 모순. 명시 계약 우선으로 `update()` 채택 (이슈 #1 해소, 2026-05-24). 02-design.md §2.5도 동반 갱신됨 |
| 3 | §2.5: `setNotificationSettings(): Promise<AlarmSubscription>` (저장 후 재조회 반환) | `Promise<void>` (쓰기 전용) | 개선 — CQS 적용. 마지막 `get()` 제거(이슈 #2 해소). 저장 후 상태는 호출자가 `getNotificationSettings`로 조회(설계 §2.4 "후속 조회"와 일관). 호출처 0건이라 무비용. 02-design.md §2.5 동반 갱신 |

### 3.3 설계 범위 외 (갭 미분류 — 의도된 범위)

- `subscriptionService.ts` 6개 메서드 본문 미구현 (`throw`/`return null`) — plan 범위표·§2.4 명시. Phase 1.5 범위.
- 버튼 핸들러 4건(`onChangeConfirm`/`onEnableSelectedRegionAlert`/`onShowSubscribeManage`/`subscribeRemove`) 명시 throw — Phase 1.5 UI 핸들러 범위.

### 3.4 코드 외 검증 보류 (런타임/수동 — 갭 아님)

- `npm run register:commands` 실행 결과 (§6-3) — 빌더 choice value 정합화는 확인됨, 실제 재등록은 런타임 검증 필요.
- Firestore round-trip / collectionGroup 필터링 / 부분 업데이트 동작 (§6-4~6) — 로직은 설계와 일치하나 Emulator 수동 검증 미실행.

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | ✅ 해소 (2026-05-24) | 품질 | `subscription.ts:89-114` | (구) 부분 업데이트가 `set(merge:true)`로 신규 문서 생성 시 `createdAt` 누락 → `getNotificationSettings`에서 `undefined.toMillis()` 런타임 throw 위험 | **적용 완료**: 3개 부분 업데이트 메서드를 `update()`로 전환 (문서 없으면 NOT_FOUND throw). "문서 생성은 setNotificationSettings만" 계약을 런타임 강제 → 무검증 캐스트가 구조적으로 안전. JSDoc에 선존재 전제 명시 |
| 2 | ✅ 해소 (2026-05-24) | 성능 | `subscription.ts:63-83` | (구) `get()`→`set()`→`get()` round-trip 3회 — 마지막 get은 반환값 재조회용 | **적용 완료**: `setNotificationSettings` 반환을 `Promise<void>`로 전환(CQS — 쓰기 전용), 마지막 `get()` 제거 → 왕복 2회. 저장 후 상태가 필요하면 호출자가 `getNotificationSettings` 호출 (설계 §2.4 "후속 조회" 패턴과 일관) |
| 3 | 🟢 Minor | 품질 | `subscription.ts:71-73` | `set(merge:true)` + 존재 분기 — 의도 맞으나 런타임 우회 시 불완전 문서 가능 | 신규 문서 `merge:false` 고려 (현 타입 계약상 동작 정상) |
| 4 | 🟢 Minor | DRY/성능 | `subscription.ts:120-132` | collectionGroup 결과 전량 메모리 적재 후 `doc.id` 필터 | 현 스키마(서브컬렉션당 settings 1건)에선 무해. "안전장치" 의도 주석 1줄 권장 |
| 5 | 🟢 Minor | 품질 | `subscription.ts:41` | 빈 `constructor() {}` 불필요 | 기존 store와 일관 — 유지 무방 |
| 6 | 🟢 Minor | 컨벤션 | `subscription.ts:1` | `import "@/common/utils/systemLogger";` side-effect import + L3 named import 중복. 본 파일은 `providerLogger`만 사용 | side-effect 라인 제거 가능 (일관성 vs 정확성 트레이드오프) |

### 4.2 컨벤션 준수 (설계 §5 체크리스트)

| 항목 | 상태 | 비고 |
|------|------|------|
| 네이밍 (camelCase/PascalCase) | ✅ | 전부 준수 |
| SystemLogger 사용 (`providerLogger`), console 금지 | ✅ | `providerLogger.info` 사용, console 0건 (기존 store보다 정확) |
| SystemError 패턴 | ✅ | store raw throw (범위 외 명시), null 정상 처리 |
| EventBus 타입 안전 이벤트 | ✅ | 신규 발행 없음, canonical 단일 참조 |
| JSDoc (public API) | ✅ | 6개 메서드 + 타입 3종 모두 보유 |
| 한국어 주석 + 영문 식별자 | ✅ | 일관 |
| `import type` 사용 | ✅ | 타입 전용 import 분리 |
| `as const` 패턴 | ✅ | AlertMode 등 전부 |
| 임포트 순서 (external→@/→상대→type) | ⚠️ | `subscription.ts` type import가 상대 value import 앞에 위치 — 정렬만 권장, 기능 영향 없음 |

### 4.3 요약

- 🔴 Critical: **0건**
- 🟡 Major: **2건 → 0건 잔여** (이슈 #1·#2 모두 ✅ 해소 2026-05-24)
- 🟢 Minor: **4건** (선택적 후속 정리)

**강점**: SoT 단일화 완결(enum/리터럴 잔재 0건), Timestamp↔number 변환 격리, `providerLogger` 명시 사용으로 로깅 컨벤션을 기존 store보다 정확히 준수.

**개선점**: 이슈 #1(`update()` 전환)·#2(`setNotificationSettings` void 전환) 모두 해소(2026-05-24, §3.2 항목 2·3). 🟢 Minor(#3~#6)는 선택적 후속 정리 항목으로 보류.

---

## 5. 다음 단계 분기

✅ **종합 매치율 100% (≥ 90%) AND 🔴 Critical 0건** → `/pdca report 1.4` 진행 가능

**CTO Lead 게이트**: matchRate ≥ 90% AND 🔴 Critical 0건 조건이므로 CTO Lead 사후 종합 평가 **생략** (비용 절감 규칙 적용).

**참고 (블로커 아님)**: 🟡 Major 2건(#1 `update()` 전환, #2 `setNotificationSettings` void 전환)은 분석 직후 모두 해소(2026-05-24, §3.2 항목 2·3). 🟢 Minor만 선택 항목으로 잔여.

---

*분석일: 2026-05-24*
*참고: docs/phase-1-4/02-design.md*

# Phase 1.5 갭 분석: notification-settings-ui

**상태**: 🔍 검토 중
**분석일**: 2026-05-25
**설계서**: `docs/phase-1-5/02-design.md`

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1 `subscriptionService.ts` 서비스 본문 신설 | `AlarmSubscriptionService` 클래스 + 싱글톤 export | ✅ | `features/alarmSubscribe/services/subscriptionService.ts` |
| S2 | §2.7 `formatRegionList.ts` 신규 헬퍼 | 파일 신설, `formatRegionList` export | ✅ | `providers/discord/builder/buttons/formatRegionList.ts:18` |
| S3 | §2.5 `koToCityEn` 역매핑 헬퍼(formatRegionList 인접) | 동일 모듈 공존 | ✅ | `providers/discord/builder/buttons/formatRegionList.ts:31` |
| S4 | §2.5 `onRegionSelectModal.ts` 신규 리스너 | 파일 신설 | ✅ | `events/listeners/buttons/onRegionSelectModal.ts` |
| S5 | §2.5 `regionSelectModal` 정본 단일화 | 정본 1개, 중복 삭제 | ✅ | `providers/discord/builder/modals/regionSelectModal.ts` |
| S6 | §2.5/§3.2 모달 customId 상수 신설(`alarmSubscribeModalId`) | 상수 파일 + barrel export | ✅ | `features/alarmSubscribe/constants/alarmSubscribeModalId.ts`, `constants/index.ts:27` |
| S7 | §2.3 `modalHandler` `:ADD`/`:REMOVE` 키 등록 | 2키 등록 | ✅ | `events/handlers/modals/index.ts:14` |
| S8 | §2.5 어댑터 `alertRegionEditHandlers` 배선 | 3키 어댑터 | ✅ | `events/handlers/buttons/alertRegionEditHandlers.ts` |
| S9 | §2.7 결정(a) `regionModeChangeButtons` 신규 안 함(재사용) | 신규 빌더 없음, `showConfirmChangeAlertModeButtons` 재사용 | ✅ | `providers/discord/builder/buttons/showConfirmChangeAlertModeButtons.ts` |
| S10 | §2.9 #B 5개 잔재 파일 삭제 | glob 0건 | ✅ | `features/alarmSubscribe/{handlers,interactions}/` (부재) |
| S11 | §2.9 #B barrel 재export 제거 | 잔재 재export 없음 | ✅ | `features/alarmSubscribe/index.ts` |
| S12 | §2.9 `features/CLAUDE.md` 구조 그림 갱신 | "Phase 1.5 구조 변경" 반영 | ✅ | `functions/src/features/CLAUDE.md` |
| S13 | §2.9 #B 잔여 import 0건 | grep 0건 | ✅ | (전수 grep) |
| S14 | §1.1 EventBus `types.ts` 변경 없음(재사용) | 이미 정의, 미변경 | ✅ | `events/bus/types.ts` |

**Structural: 14/14 완전일치**

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.1 `getUserAlertMode` → `?.alertMode ?? null` | 일치 | ✅ | `subscriptionService.ts:27-34` |
| F2 | §2.1 `getSubscription` → get 통과 | 일치 | ✅ | `subscriptionService.ts:39-45` |
| F3 | §2.1 `subscribe` → set → get → null이면 firestoreError | 일치 | ✅ | `subscriptionService.ts:53-73` |
| F4 | §2.1 `updateMode` → ensureExists → updateAlertMode → get | 일치 | ✅ | `subscriptionService.ts:81-95` |
| F5 | §2.1 `updateRegions` → ensureExists → updateAlertRegions → get | 일치 | ✅ | `subscriptionService.ts:103-117` |
| F6 | §2.1/§2.2 `unsubscribe` → null이면 no-op, 존재 시 toggle(false) | 일치 | ✅ | `subscriptionService.ts:125-146` |
| F7 | §2.2 `ensureExists` read-before-write | 일치 | ✅ | `subscriptionService.ts:154-175` |
| F8 | §3.2 subscribe만 SUBSCRIBE 발행 | 일치(쓰기 후 1회) | ✅ | `subscriptionService.ts:65-70` |
| F9 | §3.2 unsubscribe만 UNSUBSCRIBE 발행(문서 존재 시) | 일치 | ✅ | `subscriptionService.ts:141-145` |
| F10 | §3.2 `updateMode`/`updateRegions` 이벤트 미발행 | 일치 | ✅ | `subscriptionService.ts:81-117` |
| F11 | §2.4 `onEnableAllRegionAlert` 분기 | 일치 | ✅ | `events/listeners/buttons/onEnableAllRegionAlert.ts` |
| F12 | §2.4 `onEnableSelectedRegionAlert`→편집 UI 진입 | 일치(SELECTED 재진입 분기 보완) | ✅ | `events/listeners/buttons/onEnableSelectedRegionAlert.ts` |
| F13 | §2.6 `onShowSubscribeManage` Embed+조건부 편집버튼 | 일치 | ✅ | `events/listeners/buttons/onShowSubscribeManage.ts` |
| F14 | §2.3/§2.4 `onChangeConfirm`→updateMode 배선 | 현재 모드 반대로 토글 추론, confirm 2단계 호출자 미배선 | ⚠️ | `events/listeners/buttons/onChangeConfirm.ts` |
| F15 | §2.5 ADD/REMOVE 어댑터→모달 진입(defer 금지) | 일치 | ✅ | `subscribeAdd.ts`, `subscribeRemove.ts`, `regionSelectModal.ts:34` |
| F16 | §2.5 CLEAR→즉시 `updateRegions([])`→update | 일치 | ✅ | `events/listeners/buttons/subscribeClear.ts` |
| F17 | §2.5 모달 제출: deferReply(Ephemeral)→접미사 분기 | 일치 | ✅ | `onRegionSelectModal.ts:16-18` |
| F18 | §2.5 koToCityEn 검증, 미존재 ephemeral 에러 | 일치 | ✅ | `onRegionSelectModal.ts:21-25` |
| F19 | §2.5 ADD: 중복 차단 + MAX_REGION_COUNT 한도 | 일치 | ✅ | `onRegionSelectModal.ts:30-39` |
| F20 | §2.5 REMOVE: filter | 일치 | ✅ | `onRegionSelectModal.ts:40-42` |
| F21 | §2.5 갱신 후 `[formatRegionList, alertRegionEditButtons(true)]` 재노출 | 일치 | ✅ | `onRegionSelectModal.ts:44-48` |
| F22 | §2.8 #A CLEAR customId 교정 | 일치 | ✅ | `alertRegionEditButtons.ts:16` |
| F23 | §2.8 #A `setDisabled(!isSelectedRegionMode)` 반전 | 일치 | ✅ | `alertRegionEditButtons.ts:14` |
| F24 | §2.7 `formatRegionList` 빈배열/한글 join | 일치 | ✅ | `formatRegionList.ts:18-24` |
| F25 | §2.3 모달 키 일치 라우팅(게이트 밖) | 일치 | ✅ | `events/onInteraction.ts:41-48` |

**Functional: 24 완전일치 + 1 부분(F14) = 24.5/25**

> F14 부분일치: CONFIRM이 "변경 대상 모드"를 컨텍스트로 받지 않고 현재 모드의 반대로 추론. 동작은 ALL⇄SELECTED 토글로 유효하나, 즉시변경 기본 경로에서 `showConfirmChangeAlertModeButtons`를 띄우는 호출자가 본 사이클 미배선 → 도달성 측면 부분일치.

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1~C6 | §2.1 서비스 6메서드 시그니처/반환타입 | 전부 일치 | ✅ | `subscriptionService.ts:27,39,53,81,103,125` |
| C7 | §2.1 `SystemError.firestoreError(msg, error, {userId})` 래핑 | 전 메서드 일치 | ✅ | `subscriptionService.ts` 각 catch |
| C8 | §3.2 `NotificationSubscribeEvent` 페이로드 | 일치 | ✅ | `subscriptionService.ts:65-70` / `bus/types.ts` |
| C9 | §3.2 `NotificationUnsubscribeEvent` 페이로드 | 일치 | ✅ | `subscriptionService.ts:141-145` |
| C10 | §2.1 `emitEvent<T>` 타입안전 발행 | 일치 | ✅ | `subscriptionService.ts:65,141` |
| C11 | §3.2 `source: "AlarmSubscriptionService"` 상수 | `EVENT_SOURCE` const | ✅ | `subscriptionService.ts:8` |
| C12 | §2.9(f) `MessageFlags.Ephemeral` 통일 | deprecated 0건 | ✅ | `onRegionSelectModal.ts:16`, `onInteraction.ts:66` |
| C13 | §1.2 단방향(핸들러→서비스→Store) | 핸들러 Store 직접 호출 0건 | ✅ | (전수 확인) |
| C14 | §2.5/§3.2 모달 customId 상수 계약 | 빌더/핸들러 동일 소비 | ✅ | `alarmSubscribeModalId.ts:9-12` |
| C15 | §2.5 결정(b) 빌더 접미사 분기 | 일치 | ✅ | `regionSelectModal.ts:16-22` |
| C16 | §2.5 결정(c) 어댑터 시그니처 | 일치 | ✅ | `alertRegionEditHandlers.ts:14-30` |
| C17 | §2.5 `SubscribeRemovePayload.region` 처리 | `region?` optional 완화, 어댑터 미전달 | ⚠️ | `subscribeRemove.ts:6-11` |
| C18 | §2.3 `ButtonHandler` 시그니처 정합 | 일치 | ✅ | `handlers/buttons/index.ts:7` |
| C19 | §2.3 `ModalHandler` ↔ `onRegionSelectModal` | 일치 | ✅ | `handlers/modals/index.ts:5` |
| C20 | §2.8 #A toJSON 검증 통과(setStyle 2건) | ADD=Success, REMOVE=Secondary | ✅ | `alertRegionEditButtons.ts:9,13` |
| C21 | §2.5 `MAX_REGION_COUNT` SoT 재사용 | slashCommand import | ✅ | `onRegionSelectModal.ts:4` |
| C22 | §3.1 `AlarmSubscription` 계약(신규 필드 0, ms number) | 준수 | ✅ | `subscriptionService.ts:1` |

**Contract: 21 완전일치 + 1 부분(C17) = 21.5/22**

> C17 부분일치: §2.5 의사코드는 `region: ""` placeholder(필수). 구현은 §2.5 주석이 허용한 대안대로 `region?` optional 완화 + 어댑터 미전달. 타입·동작 모두 유효(실제 region은 모달 제출 확정).

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 14/14 | 100.0% |
| Functional (×0.4) | 24.5/25 | 98.0% |
| Contract (×0.4) | 21.5/22 | 97.7% |
| **종합 매치율** | | **98.3%** |

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 = 100.0×0.2 + 98.0×0.4 + 97.7×0.4 = 20.0 + 39.2 + 39.08 = 98.3%
```

---

## 3. 갭 목록

### 3.1 미구현 항목

| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| — | — | — | **미구현 항목 없음.** §2.1~§2.9 + 결정 a~g + plan 성공기준 8개 전부 구현 | — |

🔴 **Critical 갭: 0건.** 미구현 throw 스텁(`not yet implemented (Phase 1.5)`) grep 0건, 렌더 throw·미배선 모두 해소. 매치율 98.3% ≥ 90% → report 진행 가능.

### 3.2 설계 차이 (구현됨, 형태 차이)

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | §2.5 REMOVE 어댑터 `region: ""` placeholder | `region?` optional 완화, 어댑터 미전달 | 허용 (§2.5 주석 명시 대안, 정합) |
| 2 | §2.4 CONFIRM이 변경 대상 모드를 컨텍스트로 받음 | 현재 모드 반대로 토글 추론 | 허용 (즉시변경 기본, 동작 동일. confirm 2단계 호출자 미배선) |
| 3 | §2.4 SELECTED 신규/변경만 분기 | "이미 SELECTED" 케이스도 분기해 기존 regions 노출 | 허용 (설계 누락 보완) |
| 4 | §2.5 `koToCityEn` 위치 후보 다수 | `formatRegionList.ts`에 동거 | 허용 (설계가 둘 다 허용) |

### 3.3 런타임 검증 발견 (2026-05-26)

| # | 발견 | 원인 | 조치 | 상태 |
|---|------|------|------|------|
| R1 | 봇 함수 정의 로드 실패 (`app/no-app`: getFirestore가 initializeApp 전 실행) | `alarmSubscriptionService` 모듈 로드 싱글톤(`subscriptionService.ts:178`)이 import 평가 중 `new SubscriptionStore()`→생성자 `getFirestore()` 즉시 호출. Phase 1.5 do에서 stub→실구현되며 store 필드가 추가돼 첫 실행 시 노출 (정적 tsc/grep 불검출) | `SubscriptionStore.db`를 `private get db() { return getFirestore(); }` 지연 평가로 전환 | ✅ 해결 (tsc 0, 봇 재로드·로그인 성공) |
| R2 | 재활성화(꺼짐→켜짐) 시 `enabled`가 true로 안 돌아옴 — [🔔 알림 켜기]를 눌러도 화면이 "켜짐"으로 안 바뀜 (2026-05-27) | **설계 전제 오류**(design §8.1 "신규 enable 메서드 불요"). 기존 문서 보유 상태의 ENABLE이 모드선택→`updateMode`(alertMode만 갱신)로 분기 → `enabled`를 true로 되돌리는 경로 부재. `subscribe()`(enabled:true)는 신규 문서일 때만 실행 (정적 tsc 불검출, 런타임에서만 노출) | 서비스 `resubscribe(userId)` 신설(`toggleNotificationEnabled(true)`+재조회+`NOTIFICATION_SUBSCRIBE` 발행), `onShowSubscribeEnable` 상태분기(기존데이터→resubscribe / 미설정→모드선택). 신규 customId 없음(게이트 불변) | ✅ 해결 (tsc 0, 런타임 로그 resubscribe 3회 무오류 + UI 직접 확인) |

> R1·R2 모두 정적 분석으로 잡히지 않는 **런타임 갭**(R1=초기화 순서, R2=상태 분기 누락). R1은 `providers/firebase/store/subscription.ts` 1곳, R2는 `subscriptionService.ts`(`resubscribe` 추가)+`onShowSubscribeEnable.ts`(상태 분기) 2곳 수정. R2 검증은 EventBus emit 로그(`toggleNotificationEnabled`는 무로그라 emit이 유일 흔적)와 UI 직접 확인 병행.

### 3.4 2차 확장 (#1·#2·#3, design §8) — 구현 완료, 런타임 검증 대기

진입 상태 분기+on/off 토글, 모드 변경(고아 자산 재활용), 뒤로가기, 관리 버튼 통합. 6 신규 + 7 수정 파일. **사용자 결정으로 재analyze 생략** → 런타임 검증 G1~G10으로 갈음. 정적: tsc 0(기본+build config watch), 신규 customId 3종 게이트 등록 확인, 중복 문구 버그 1건 수정.

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | ✅ 보강완료 | 에러 | `events/onInteraction.ts:63-74` | 핸들러 에러→ephemeral 변환이 `reply()`로만 처리. 대부분 핸들러가 진입 직후 `deferUpdate/deferReply` 호출하므로, 이후 throw 시 이미 acknowledged → `reply()` 실패하고 `.catch(()=>{})`로 삼켜져 **사용자에게 에러 미노출**. 서비스 `firestoreError`의 주 경로가 해당 | **(2026-05-26 보강)** `interaction.deferred \|\| replied` 분기로 `followUp` 사용(원본 UI 보존), 그 외 `reply`. tsc 0 errors |
| 2 | 🟡 | 타입 | `onEnableSelectedRegionAlert.ts:20` | `let regions;` 타입·초기값 없이 선언 → strict evolving-any, `CityEn[]` 보장 상실 | `let regions: CityEn[];` 명시 |
| 3 | 🟢 | DRY | `subscribeAdd.ts:8-9` · `subscribeRemove.ts:8-10` | 페이로드 `mode`·`region?` 필드가 어댑터에서 고정 주입되나 본문에서 미사용 | 미사용 필드 제거 또는 보류 근거 주석 |
| 4 | 🟢 | DRY | `onAlertRegionEdit.ts:22-27` | switch case가 문자열 리터럴 하드코딩(상수 union인데 SoT 우회) | `case fullActionId.REGION_EDIT_ADD:` 상수 참조 |
| 5 | 🟢 | DRY | `alertRegionEditHandlers.ts:18,23,28` | 3키 동일 payload 구조 반복(#3 연동) | #3 해소 시 자연 정리 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemError.firestoreError 패턴 | ✅ | 6메서드 + ensureExists 전부 try-catch 래핑, CQS 후속 get null 방어 포함 |
| 핸들러 에러→ephemeral 변환 | ✅ | (2026-05-26 보강) defer/reply 시 followUp 분기로 무력화 해소 |
| eventBus.emitEvent<T> 타입 안전 발행 | ✅ | subscribe/unsubscribe 제네릭+timestamp+source, 쓰기 성공 후 발행. update* 미발행 |
| MessageFlags.Ephemeral 통일 | ✅ | `ephemeral: true` 0건 |
| providerLogger/createLogger, console 0건 | ✅ | console.* 0건 |
| 핸들러→서비스→Store 단방향 | ✅ | Store 직접 import 0건 |
| JSDoc (public 메서드 6개) | ✅ | 전부 보유 |
| showModal defer 이전만 | ✅ | ADD/REMOVE 어댑터 defer 없음 |
| 네이밍 camelCase/PascalCase | ✅ | 준수 |
| import 정리 | ✅ | 미사용 import 0건 |
| #A 잔재 fix / #B cleanup | ✅ | setStyle 정상, interactions/ 잔재 0건 |

#### 중점 점검
- **보안**: userId는 `interaction.user.id`만 사용, 모달 입력은 `koToCityEn` 화이트리스트 검증, MAX 상한 enforce. ephemeral+본인 한정이라 echo 노출 위험 없음.
- **DRY**: `koToCityEn` 모듈 1회 구성, `MAX_REGION_COUNT` 단일 SoT, `CITIES` 단일 참조. 잔여는 #3~#5(경미).
- **성능**: CQS 후속 get·ensureExists read-before-write는 설계 의도(갭 아님).
- **에러**: NOT_FOUND `ensureExists` 선차단, unsubscribe no-op, 이벤트 쓰기 후 발행.
- **strict/any**: 명시 any 0건, 이슈 #2 암묵 evolving-any 1건만.

### 4.3 요약
- 🔴 Critical: **0건**
- 🟡 Warning: **2건 중 1건 보강완료** (#1 defer 이후 에러 ephemeral 무력화 → ✅ 2026-05-26 보강, #2 `let regions` 타입 미명시 — 잔여)
- 🟢 Info: **3건** (미사용 payload 필드, switch 리터럴, 어댑터 중복 — 상호 연동)

---

## 5. 다음 단계 분기

✅ **종합 매치율 98.3% ≥ 90% AND 🔴 Critical 0건** → `/pdca report 1.5` 진행 가능. iterate 불요.

**CTO Lead 게이트**: matchRate ≥ 90% AND 🔴 Critical 0건 조건이므로 CTO Lead 사후 종합 평가 **생략** (비용 절감 규칙).

**참고 (블로커 아님)**: 🟡 #1(defer 후 throw 시 에러 미노출)은 실사용 영향이 있어 **report 전 선택적 보강 완료**(2026-05-26, `onInteraction.ts` followUp 분기, tsc 0 errors). 잔여 🟡 #2와 🟢 3건은 매치율 ≥ 90%라 iterate 강제 대상 아님 — 선택적 후속 정리.

---

*분석일: 2026-05-25*
*참고: docs/phase-1-5/02-design.md*

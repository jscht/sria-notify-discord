# Phase 1.5 설계서: 알림 설정 UI 완성 (notification-settings-ui)

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-5/01-plan.md`
**작성자(주관)**: Integration Lead │ **UI 입력**: Discord Agent │ **데이터 계약 검토**: Backend Expert

> **경로 주의**: 본 설계는 모든 경로를 `functions/src/` 접두 **실제 경로**로 표기한다.
> plan의 `providers/...` 약식 표기는 실제로 `functions/src/providers/...`, `functions/src/events/...`이다.

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Presentation — 라우팅 (`functions/src/events/onInteraction.ts`) | 모달은 `isValidFullActionId` 게이트 없이 `modalHandler[customId]` 키 일치로 직접 라우팅(접미사 분기), 파일 변경 없이 재사용 |
| Presentation — 핸들러 맵 (`functions/src/events/handlers/{buttons,modals}/`) | `alertRegionEditHandlers` 어댑터 배선, `modalHandler` 모달 제출 등록 |
| Presentation — 리스너 (`functions/src/events/listeners/{buttons,commands}/`) | throw 핸들러 7건 + `onAlertRegionEdit`/`subscribe*` 본문 구현, `onRegionSelectModal` 신규 |
| UI 빌더 (`functions/src/providers/discord/builder/buttons/`) | `alertRegionEditButtons` 잔재 #A fix, `formatRegionList` 신규(헬퍼) — `regionModeChangeButtons`는 §2.7 결정으로 **신규 생성 안 함** |
| Services (`functions/src/features/alarmSubscribe/services/subscriptionService.ts`) | `AlarmSubscriptionService` 6개 메서드 본문 구현 (CQS 오케스트레이션) |
| Store (`functions/src/providers/firebase/store/subscription.ts`) | **변경 없음** — Phase 1.4 완료된 `SubscriptionStore` 호출만 |
| EventBus (`functions/src/events/bus/types.ts`) | **변경 없음** — `NotificationSubscribe/UnsubscribeEvent` 이미 정의됨(§3.2). 발행 지점만 신설 |
| Common Types (`functions/src/common/types/alarmSubscription.ts`) | **변경 없음** — `AlarmSubscription`/`AlertMode`/`CityEn` 재사용 |
| Constants (`functions/src/features/alarmSubscribe/constants/`) | 모달 customId 상수 신설(`alarmSubscribeModalId`), `fullActionId` 변경 없음 |
| 잔재 삭제 (#B) (`functions/src/features/alarmSubscribe/{handlers,interactions}/`) | 5개 파일 삭제 + `index.ts` 재export 정리 |

> **SoT 정정 (코드 확인 결과)**:
> 1. live `/alarm-subscribe` 진입점은 `events/listeners/commands/onAlarmSubscribe.ts` (이미 `MessageFlags.Ephemeral` 사용, `providers/.../showSubscribeOptionButtons.ts` 호출)이다. `features/.../handlers/commandHandler.ts`(구 ephemeral 미적용·중복 빌더 import)는 **dead code(#B)**.
> 2. `events/bus/types.ts`에 `NotificationSubscribeEvent`(userId+settings), `NotificationUnsubscribeEvent`(userId)가 **이미 정의·매핑됨**. plan의 "신설 필요"는 정정 — **발행 코드만 신설**한다.

### 1.2 컴포넌트 다이어그램

```
/alarm-subscribe (slash)
   │  commandHandlers[ALARM_SUBSCRIBE]
   ▼
onAlarmSubscribe ── reply(ephemeral) ─→ [showSubscribeOptionButtons]
   │                                         ENABLE / MANAGE
   ├─ ENABLE  → onShowSubscribeEnable(update) → [showAlertModeSelectButtons] ALL/SELECTED
   │                │
   │                ├─ ALL      → onEnableAllRegionAlert ───┐
   │                └─ SELECTED → onEnableSelectedRegionAlert ┤
   │                                                          ▼
   │                                         AlarmSubscriptionService
   │                                          (getUserAlertMode → subscribe | updateMode)
   │                                                          │
   │                              ┌───────────────────────────┴───────────────┐
   │                              ▼                                            ▼
   │                        SubscriptionStore                            EventBus
   │                  (set / update / get / toggle)        emit NOTIFICATION_SUBSCRIBE / _UNSUBSCRIBE
   │                              │ (Firestore)                    (Phase 1.7 소비)
   │                              ▼
   │                  users/{userId}/notifications/settings
   │
   ├─ MANAGE  → onShowSubscribeManage → getSubscription → [Embed + alertRegionEditButtons]
   │
   └─ (SELECTED 모드 지역편집) [alertRegionEditButtons] ADD / REMOVE / CLEAR
            ├─ ADD/REMOVE → showModal(regionSelectModal:ADD|REMOVE)  (defer 금지)
            │        ▼ 제출
            │   modalHandler["alarm-subscribe-modal:ADD|REMOVE"] → onRegionSelectModal
            │        → 한글→CityEn 검증 → updateRegions → editReply([formatRegionList + buttons])
            └─ CLEAR → subscribeClear → updateRegions(userId, []) → update
```

핸들러 → 서비스 → Store 단방향. 핸들러는 **Store 직접 호출 금지**, 항상 `alarmSubscriptionService` 경유.

---

## 2. 상세 설계

### 2.1 AlarmSubscriptionService — 서비스↔Store 호출 매핑 (CQS 오케스트레이션)

**파일**: `functions/src/features/alarmSubscribe/services/subscriptionService.ts`

`SubscriptionStore`의 쓰기 메서드는 전부 `void`(CQS), 읽기만 데이터를 반환한다. 부분 업데이트(`updateAlertMode/updateAlertRegions/toggleNotificationEnabled`)는 **문서 선존재 전제**(없으면 Firestore NOT_FOUND). 서비스가 이 시퀀스/선존재를 책임진다.

**서비스 6개 메서드 → Store 호출 매핑표**:

| 서비스 메서드 | 반환 | Store 호출 시퀀스 | 비고 |
|--------------|------|------------------|------|
| `getUserAlertMode(userId)` | `AlertMode \| null` | `getNotificationSettings(userId)` → `?.alertMode ?? null` | 단순 조회 |
| `getSubscription(userId)` | `AlarmSubscription \| null` | `getNotificationSettings(userId)` | 단순 조회 (그대로 통과) |
| `subscribe(userId, input)` | `AlarmSubscription` | `setNotificationSettings(userId, input)` → `getNotificationSettings(userId)` | **set 선행(생성/덮어쓰기) → get으로 결과 반환**. set은 void이므로 후속 get 필수 |
| `updateMode(userId, alertMode)` | `AlarmSubscription` | **선존재 보장(§2.2)** → `updateAlertMode(userId, alertMode)` → `getNotificationSettings(userId)` | 부분 업데이트, 선존재 전제 |
| `updateRegions(userId, regions)` | `AlarmSubscription` | **선존재 보장(§2.2)** → `updateAlertRegions(userId, regions)` → `getNotificationSettings(userId)` | 부분 업데이트, 선존재 전제 |
| `unsubscribe(userId)` | `void` | `toggleNotificationEnabled(userId, false)` (문서 미존재 시 no-op 또는 방어, §2.2) | 활성화 플래그만 끔. 문서 삭제 아님 |

**CQS 후속 get 계약**: 쓰기가 `void`이고 핸들러는 갱신된 상태(`regions`, `alertMode`, `enabled`)를 UI에 즉시 렌더해야 하므로, 쓰기 메서드 직후 `getNotificationSettings`로 재조회하여 `AlarmSubscription`을 반환한다. `get`이 `null`을 반환하면(쓰기 직후 정상 경로에서는 불가) `SystemError.firestoreError`로 승격.

**핵심 로직 (pseudo)**:
```typescript
async subscribe(userId, input: AlarmSubscriptionInput): Promise<AlarmSubscription> {
  await this.store.setNotificationSettings(userId, input);     // void (생성/덮어쓰기)
  const saved = await this.store.getNotificationSettings(userId); // 후속 조회
  if (!saved) throw SystemError.firestoreError("구독 저장 직후 조회 실패", undefined, { userId });
  eventBus.emitEvent<NotificationSubscribeEvent>(EventType.NOTIFICATION_SUBSCRIBE, {
    timestamp: Date.now(), source: "AlarmSubscriptionService", userId, settings: saved,
  });
  return saved;
}

async updateRegions(userId, regions: CityEn[]): Promise<AlarmSubscription> {
  await this.ensureExists(userId);                  // §2.2 선존재 보장
  await this.store.updateAlertRegions(userId, regions); // void (부분 업데이트)
  const updated = await this.store.getNotificationSettings(userId);
  if (!updated) throw SystemError.firestoreError("지역 업데이트 직후 조회 실패", undefined, { userId });
  return updated; // updateRegions 자체는 이벤트 미발행 (subscribe 시점에 1회 발행)
}
```

**에러 처리**:
- Store 호출 try-catch → `SystemError.firestoreError(message, error, { userId })`로 래핑 후 재throw.
- 핸들러 계층이 catch하여 사용자 ephemeral 에러 메시지로 변환(§2.6).
- 이벤트 발행은 쓰기 성공 후에만 (실패 시 미발행).

> **이벤트 발행 지점 정책 (Integration Lead 확정)**: 신규 활성화 = `subscribe`에서 `NOTIFICATION_SUBSCRIBE` 1회. 해제 = `unsubscribe`에서 `NOTIFICATION_UNSUBSCRIBE` 1회. `updateMode/updateRegions`는 **이미 구독 중인 사용자의 설정 변경**이므로 별도 이벤트 미발행(Phase 1.7 알림 발송은 `enabled=true` 구독자 전체를 주기 조회하므로 변경 이벤트 불필요). 모드를 ALL↔SELECTED로 바꾸는 `onEnableAll/Selected`가 신규 활성화이면 `subscribe`, 기존 구독 변경이면 `updateMode`로 분기(§2.4).
>
> **[정정 2026-05-27]** 위 "주기 조회하므로 변경 이벤트 불필요"는 근거가 부정확하다. 발행 기준은 *발송 수요(pull)* 가 아니라 **도메인 입도**다 — `subscribe`/`unsubscribe`/`resubscribe`는 **라이프사이클 전이**라 발행, `updateMode`/`updateRegions`는 **속성 조정**이라 무발행. 재활성화 `resubscribe`(§8.1 정정)도 동일 입도로 `NOTIFICATION_SUBSCRIBE`를 발행한다(현재 소비 핸들러 0건이라 emit은 no-op, 미래 소비자 결합 대비). 상세: analysis §3.3 R2.

### 2.2 NOT_FOUND 방어 — 선존재 보장 패턴 (Backend Expert 검토 반영)

**파일**: `functions/src/features/alarmSubscribe/services/subscriptionService.ts` (private 헬퍼)

부분 업데이트 3종(`updateAlertMode/updateAlertRegions/toggleNotificationEnabled`)은 `update()` 기반이라 문서 미존재 시 Firestore가 `NOT_FOUND`(code 5)를 throw한다. Backend Expert 검토 결론:

**선택안 — 사전 보장(read-before-write) 방식 채택**:
```typescript
private async ensureExists(userId: string): Promise<AlarmSubscription> {
  const existing = await this.store.getNotificationSettings(userId);
  if (existing) return existing;
  // 미존재 → 기본값으로 set 선행 (createdAt 채워짐)
  const defaults: AlarmSubscriptionInput = { enabled: true, alertMode: AlertMode.ALL, regions: [] };
  await this.store.setNotificationSettings(userId, defaults);
  const created = await this.store.getNotificationSettings(userId);
  if (!created) throw SystemError.firestoreError("기본 구독 생성 직후 조회 실패", undefined, { userId });
  return created;
}
```

**Backend Expert 코멘트 요약**:
1. **read-before-write vs NOT_FOUND-catch 트레이드오프** — 본 기능은 호출 빈도가 낮고(사용자 수동 인터랙션) 동시성 충돌 가능성이 사실상 없다. read 1회 추가 비용은 무시 가능. 따라서 "예외를 정상 흐름 제어로 쓰는" catch-NOT_FOUND-then-set보다 **명시적 사전 조회(ensureExists)** 가 가독성·디버깅 우위. 채택.
2. **NOT_FOUND 식별 보강(방어 2선)** — 그럼에도 TOCTOU(조회와 update 사이 문서 삭제) 같은 희소 경합 대비, `update()` 경로 try-catch에서 `error.code === 5`(GRPC NOT_FOUND) 또는 `(error as {code?: number}).code === 5`를 감지하면 `setNotificationSettings`로 폴백 후 1회 재시도하는 가드를 서비스에 둘 수 있다(선택적 강화, do 단계 재량). 단, 무한 재귀 방지 위해 재시도는 1회로 제한.
3. **`unsubscribe`의 미존재 처리** — 구독한 적 없는 사용자가 해제 시도 시 `toggleNotificationEnabled`가 NOT_FOUND. 이때는 "이미 해제 상태"로 간주하고 **조용히 no-op**(ensureExists로 문서 만들지 말 것 — 끄려는데 켜진 문서를 새로 만드는 건 비논리). 구현: `getNotificationSettings`가 null이면 즉시 return, 존재하면 `toggleNotificationEnabled(false)` + `NOTIFICATION_UNSUBSCRIBE` 발행.
4. **`subscribe`는 `setNotificationSettings`(set+merge)라 선존재 불요** — set은 문서 유무 무관하게 안전(merge:true, 신규 시 createdAt 채움). 따라서 `subscribe`/신규 활성화 경로는 `ensureExists` 불필요.
5. **스키마 변경 없음 확인** — 신규 Firestore 필드·컬렉션 없음. Phase 1.4 `AlarmSubscription` 계약(`enabled/alertMode/regions/createdAt/updatedAt`, ms number 경계)을 그대로 준수. 경량 리뷰로 충분.

### 2.3 핸들러 ↔ 서비스 배선도 (customId 라우팅 통합)

**파일**: `functions/src/events/handlers/buttons/`, `functions/src/events/handlers/modals/index.ts`

| customId | 핸들러 맵 → 리스너 | UI 동작 | 호출 서비스 | 현재 → 목표 |
|----------|-------------------|---------|------------|------------|
| `SUBSCRIBE_OPTION:ENABLE` | `subscribeOptionHandlers` → `onShowSubscribeEnable` | `update` 모드선택 노출 | — | 구현됨(유지) |
| `SUBSCRIBE_OPTION:MANAGE` | `subscribeOptionHandlers` → `onShowSubscribeManage` | `deferUpdate`→구독조회→관리 Embed+편집버튼 | `getSubscription(userId)` | THROW → 구현 |
| `ALERT_MODE:ALL` | `alertModeSelectHandlers` → `onEnableAllRegionAlert` | `deferUpdate`→ALL 확정→완료 안내 | `getUserAlertMode`→`subscribe`/`updateMode` | THROW → 구현 |
| `ALERT_MODE:SELECTED` | `alertModeSelectHandlers` → `onEnableSelectedRegionAlert` | `deferUpdate`→SELECTED 확정→지역편집 진입 | `getUserAlertMode`→`subscribe`/`updateMode` | THROW → 구현 |
| `REGION_MODE_CHANGE:CONFIRM` | `regionModeConfirmHandlers` → `onChangeConfirm` | `deferUpdate`→모드변경 확정 | `updateMode(userId, mode)` | THROW → 구현 |
| `REGION_MODE_CHANGE:CANCEL` | `regionModeConfirmHandlers` → `onChangeCancel` | `update` 컴포넌트 제거 | — | 구현됨(유지) |
| `REGION_EDIT:ADD` | `alertRegionEditHandlers` → **어댑터** → `onAlertRegionEdit({action:ADD,...})` | `showModal(ADD)` (defer 금지) | (제출 시점) | notImplemented → 어댑터 |
| `REGION_EDIT:REMOVE` | `alertRegionEditHandlers` → **어댑터** → `onAlertRegionEdit({action:REMOVE,...})` | `showModal(REMOVE)` (defer 금지) | (제출 시점) | notImplemented → 어댑터 |
| `REGION_EDIT:CLEAR` | `alertRegionEditHandlers` → **어댑터** → `onAlertRegionEdit({action:CLEAR,...})` | 즉시 초기화 | `updateRegions(userId, [])` | notImplemented → 어댑터 |
| `alarm-subscribe-modal:ADD` (모달) | `modalHandler` → `onRegionSelectModal` | 한글→CityEn 검증→추가 | `updateRegions(userId, [...regions, region])` | 미등록 → 등록 |
| `alarm-subscribe-modal:REMOVE` (모달) | `modalHandler` → `onRegionSelectModal` | 한글→CityEn 검증→제거 | `updateRegions(userId, regions.filter(...))` | 미등록 → 등록 |

### 2.4 throw 핸들러 본문 — 모드 확정 로직 (`onEnableAll/SelectedRegionAlert`)

**파일**: `functions/src/events/listeners/buttons/onEnableAllRegionAlert.ts`, `onEnableSelectedRegionAlert.ts`

신규 활성화와 기존 모드 변경을 분기한다:
```typescript
async function onEnableAllRegionAlert(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const current = await alarmSubscriptionService.getUserAlertMode(userId);
  if (current === null) {
    // 신규 구독 → set 선행 (이벤트 발행은 subscribe 내부)
    await alarmSubscriptionService.subscribe(userId, { enabled: true, alertMode: AlertMode.ALL, regions: [] });
  } else if (current !== AlertMode.ALL) {
    await alarmSubscriptionService.updateMode(userId, AlertMode.ALL); // 모드 변경
  }
  await interaction.editReply({ content: "✅ 모든 지역 알림이 설정되었어요.", components: [] });
}
```
SELECTED 버전은 마지막 `editReply`에서 `[formatRegionList(regions), alertRegionEditButtons(true)]`를 노출하여 지역 편집 UI로 진입.

> **모드 변경 확인(REGION_MODE_CHANGE) 흐름 연결**: 기존 모드와 다른 모드를 누른 경우 즉시 변경 대신 `showConfirmChangeAlertModeButtons()`로 확인을 받고 `onChangeConfirm`에서 `updateMode`를 호출하는 2단계 경로도 허용. 본 사이클은 **즉시 변경**(위 코드)을 기본으로 하고, 확인 단계는 `onChangeConfirm`(§2.3 CONFIRM 행)이 `updateMode`를 호출하도록 배선만 완성한다.

### 2.5 지역 편집 어댑터 + 모달 제출 핸들러

**파일**: `functions/src/events/handlers/buttons/alertRegionEditHandlers.ts` (어댑터), `functions/src/events/listeners/buttons/onRegionSelectModal.ts` (신규 리스너)

**어댑터 배선 (결정 c — 아래)**: `notImplemented`를 각 키별 어댑터 함수로 교체. `buttonHandlers`는 `(interaction: ButtonInteraction) => unknown` 시그니처를 요구하나 `onAlertRegionEdit`는 `{action, payload}`를 받으므로, 각 키에서 `interaction`을 받아 payload를 조립해 `onAlertRegionEdit`로 위임:
```typescript
export const alertRegionEditHandlers: Record<string, ButtonHandler> = {
  [fullActionId.REGION_EDIT_ADD]:    (i) => onAlertRegionEdit({ action: fullActionId.REGION_EDIT_ADD,    payload: { interaction: i, mode: AlertMode.SELECTED } }),
  [fullActionId.REGION_EDIT_REMOVE]: (i) => onAlertRegionEdit({ action: fullActionId.REGION_EDIT_REMOVE, payload: { interaction: i, mode: AlertMode.SELECTED, region: "" } }),
  [fullActionId.REGION_EDIT_CLEAR]:  (i) => onAlertRegionEdit({ action: fullActionId.REGION_EDIT_CLEAR,  payload: { interaction: i, mode: AlertMode.SELECTED } }),
};
```
- ADD/REMOVE의 `subscribeAdd`/`subscribeRemove`는 **모달을 띄우는 단계**로 재정의(서비스 호출은 모달 제출로 미룸). `showModal`은 `deferUpdate`/`deferReply` 이전에만 호출 가능하므로 ADD/REMOVE 어댑터 경로는 **defer 금지**.
- CLEAR(`subscribeClear`)만 즉시 `updateRegions(userId, [])` 실행 후 `interaction.update`로 갱신.

> `subscribeRemove`의 `region`은 필수 타입이나 모달 진입 단계에서는 미확정 → 모달을 띄우는 단계에서는 빈 문자열 placeholder. 실제 region 값은 모달 제출(`onRegionSelectModal`)에서 확정. (타입 정합을 위해 do 단계에서 `SubscribeRemovePayload.region`을 optional로 완화하거나 ADD/REMOVE 공통 payload로 통합 검토)

**모달 제출 핸들러** (`onRegionSelectModal`):
```typescript
async function onRegionSelectModal(interaction: ModalSubmitInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const userId = interaction.user.id;
  const isAdd = interaction.customId.endsWith(":ADD");      // 접미사 분기 (결정 b: 안 A)
  const raw = interaction.fields.getTextInputValue("region").trim();

  const cityEn = koToCityEn(raw); // CITIES 값 역매핑 (서울→seoul)
  if (!cityEn) { await interaction.editReply({ content: `❌ '${raw}' 은(는) 지원하지 않는 지역입니다.` }); return; }

  const sub = await alarmSubscriptionService.getSubscription(userId);
  const current = sub?.regions ?? [];
  let next: CityEn[];
  if (isAdd) {
    if (current.includes(cityEn)) { await interaction.editReply({ content: "이미 추가된 지역이에요." }); return; }
    if (current.length >= MAX_REGION_COUNT) { await interaction.editReply({ content: `최대 ${MAX_REGION_COUNT}개까지 선택할 수 있어요.` }); return; }
    next = [...current, cityEn];
  } else {
    next = current.filter((r) => r !== cityEn);
  }
  const updated = await alarmSubscriptionService.updateRegions(userId, next);
  await interaction.editReply({ content: formatRegionList(updated.regions), components: [alertRegionEditButtons(true)] });
}
```
- `koToCityEn`: `CITIES`(en→ko)의 역방향 조회 헬퍼. 미존재 입력은 ephemeral 에러. (위치: `formatRegionList`와 같은 빌더/헬퍼 모듈 또는 `@/common/constants/city` 인접)
- `MAX_REGION_COUNT`(=2)는 `features/alarmSubscribe/commands/slashCommand.ts`에서 재사용(SoT).
- 모달 등록: `modalHandler["alarm-subscribe-modal:ADD"] = onRegionSelectModal; modalHandler["alarm-subscribe-modal:REMOVE"] = onRegionSelectModal;` — 모달 customId는 `isValidFullActionId` 게이트 밖이므로 `modalHandler` 키 일치만으로 라우팅됨.

### 2.6 onShowSubscribeManage — 구독 상태 조회 + 관리 UI

**파일**: `functions/src/events/listeners/buttons/onShowSubscribeManage.ts`
```typescript
async function onShowSubscribeManage(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
  if (!sub) { await interaction.editReply({ content: "아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.", components: [] }); return; }
  const embed = buildSubscribeManageEmbed(sub); // alertMode/enabled/formatRegionList(regions)
  const components = sub.alertMode === AlertMode.SELECTED ? [alertRegionEditButtons(true)] : [];
  await interaction.editReply({ embeds: [embed], components });
}
```
- MANAGE는 **Embed 사용**(개인 설정 요약 가독성). 나머지 흐름은 plain `content` 유지(기존 일관성, 결정 §3-2 Discord 입력 권장 반영).

### 2.7 UI 헬퍼

**파일**: `functions/src/providers/discord/builder/buttons/formatRegionList.ts` (신규)
```typescript
export function formatRegionList(regions: CityEn[]): string {
  if (regions.length === 0) return "선택된 지역이 없습니다.";
  const ko = regions.map((r) => CITIES[r]).join(", ");
  return `현재 선택 지역: ${ko}`;
}
```
- 변환 소스는 `@/common/constants/city`의 `CITIES` 단일 사용.

**`regionModeChangeButtons()` — 신규 생성 안 함 (결정 a)**: 기존 `showConfirmChangeAlertModeButtons()`(CANCEL=Secondary "취소", CONFIRM=Primary "네, 변경할래요")가 동일 역할·동일 customId(`regionModeChangeActionId`)이다. **신규 빌더를 만들지 않고 기존 함수를 재사용**한다. plan §구현전략의 "regionModeChangeButtons 신규"는 본 결정으로 **기존 재사용**으로 대체(중복 회피). (do 단계 산출물 목록에서 신규 헬퍼는 `formatRegionList` 1개만.)

### 2.8 잔재 #A 버그 fix

**파일**: `functions/src/providers/discord/builder/buttons/alertRegionEditButtons.ts`

현재 코드의 3개 결함 + 1개 논리 버그를 교정:

| # | 현재 | 교정 |
|---|------|------|
| 1 | ADD 버튼 `.setStyle()` 누락 → `toJSON` 검증 실패 throw | `.setStyle(ButtonStyle.Success)` 추가 |
| 2 | REMOVE 버튼 `.setStyle()` 누락 | `.setStyle(ButtonStyle.Secondary)` 추가 |
| 3 | "🧹 초기화" 버튼 customId가 `alertRegionEditActionId.ADD` 오배선 → CLEAR 도달 불가 | `.setCustomId(alertRegionEditActionId.CLEAR)` |
| 4 | REMOVE `.setDisabled(isSelectedRegionMode)` — 의미 반전(SELECTED 모드에서 비활성) | `.setDisabled(!isSelectedRegionMode)` (ALL 모드에서 비활성) |

> `setStyle` 누락은 **렌더 시점 throw**라 ADD/REMOVE 버튼이 포함된 모든 화면(지역편집 진입·모달 재노출·MANAGE)이 죽는다. 최우선 fix.

### 2.9 잔재 #B 삭제 + ephemeral 통일

**삭제 대상 5개 파일** (`functions/src/features/alarmSubscribe/`):
- `handlers/commandHandler.ts` (중복 `onAlarmSubscribe`, live는 `events/listeners/commands/onAlarmSubscribe.ts`)
- `handlers/buttonHandler.ts` (`onSubscribeOptionButton` — 미배선 스텁)
- `handlers/modalHandler.ts` (`onRegionSelectModal` 스텁 — 신규 리스너는 `events/listeners/buttons/onRegionSelectModal.ts`로 이관)
- `interactions/buttons.ts` (중복 `showSubscribeOptionButtons` — **setStyle 없는 버전**, 렌더 throw 위험. 정본은 `providers/.../showSubscribeOptionButtons.ts`)
- `interactions/modals.ts` (중복 `regionSelectModal`. 정본은 `providers/discord/builder/modals/` 또는 신규 위치로 단일화)

**동반 수정**:
- `features/alarmSubscribe/index.ts` — 재export 제거: `showSubscribeOptionButtons`(interactions), `regionSelectModal`(interactions), `onAlarmSubscribe`(commandHandler), `onSubscribeOptionButton`(buttonHandler), `onRegionSelectModal`(modalHandler) 5줄(L10·11·14·15·16).
- `functions/src/features/CLAUDE.md` — 옛 구조 그림(`handlers/`, `interactions/`, `notificationSettingsService`) 갱신.
- 삭제 후 `grep`으로 잔여 import 0건 확인 (특히 `regionSelectModal`은 모달 제출 흐름에서 사용하므로 **정본 1개를 먼저 확정·이관 후** 중복 삭제).

> **삭제 순서 (리스크 대응)**: 파일 삭제 + `index.ts` 재export 제거 + 정본 import 경로 교체를 **동일 do 단위**로 묶어 컴파일 붕괴/dangling export 방지.

**ephemeral 통일 (결정 f)**: 신규/수정 코드는 모두 `flags: MessageFlags.Ephemeral` 사용(deprecated `ephemeral: true` 금지). 개인 데이터(구독 설정·지역) 응답은 ephemeral 기본. 모달 제출은 `deferReply({ flags: MessageFlags.Ephemeral })`.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조 (변경 없음 — Phase 1.4)

| 컬렉션/경로 | 문서 구조 | 용도 |
|------------|----------|------|
| `users/{userId}/notifications/settings` (문서 ID 고정 "settings") | `{ enabled: boolean, alertMode: "ALL"\|"SELECTED", regions: CityEn[], createdAt: Timestamp, updatedAt: Timestamp }` | 사용자 알림 구독 설정 |

- 앱 경계는 항상 `number`(ms). Timestamp↔number 변환은 `SubscriptionStore.toAlarmSubscription`에서만. **신규 필드·컬렉션 없음**.

### 3.2 이벤트 페이로드 (이미 정의됨 — 발행 코드만 신설)

**파일**: `functions/src/events/bus/types.ts` (현행 정의 그대로 사용, 변경 없음)

| 이벤트 타입 (EventType) | 페이로드 인터페이스 | 필드 | 발행 시점 | 발행처 |
|------------------------|--------------------|------|----------|--------|
| `NOTIFICATION_SUBSCRIBE` (`"notification:subscribe"`) | `NotificationSubscribeEvent extends BaseEvent` | `userId: string`, `settings: AlarmSubscription` | `subscribe()` 성공 직후(신규 활성화) | `AlarmSubscriptionService.subscribe` |
| `NOTIFICATION_UNSUBSCRIBE` (`"notification:unsubscribe"`) | `NotificationUnsubscribeEvent extends BaseEvent` | `userId: string` | `unsubscribe()` 성공 직후(기존 문서 존재 시) | `AlarmSubscriptionService.unsubscribe` |

- `BaseEvent`: `{ timestamp: number, source?: string }`. 발행 시 `timestamp: Date.now()`, `source: "AlarmSubscriptionService"`.
- `updateMode`/`updateRegions`는 **이벤트 미발행**(§2.1 정책). Phase 1.7 자동 알림은 `getAllActiveSubscribers`(enabled==true) 주기 조회 기반이므로 설정 변경 이벤트가 필요 없다.
- **Phase 1.7 의존 지점**: `NotificationSubscribeEvent.settings`는 변경 후 최종 상태(`AlarmSubscription`)를 그대로 담는다 → Phase 1.7 리스너가 별도 재조회 없이 즉시 필터링 가능.

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | 잔재 #A fix (setStyle 2건 + CLEAR customId + setDisabled 반전) | `providers/discord/builder/buttons/alertRegionEditButtons.ts` | §2.8 |
| 2 | `AlarmSubscriptionService` 6개 메서드 + `ensureExists` + 이벤트 발행 | `features/alarmSubscribe/services/subscriptionService.ts` | §2.1, §2.2 |
| 3 | UI 헬퍼 `formatRegionList` + `koToCityEn` 역매핑 | `providers/discord/builder/buttons/formatRegionList.ts` | §2.7, §2.5 |
| 4 | throw 핸들러 4건 본문 (`onEnableAll/Selected`, `onShowSubscribeManage`, `onChangeConfirm`) | `events/listeners/buttons/*` | §2.4, §2.6, §2.3 |
| 5 | 지역 편집 어댑터 배선 + `subscribeAdd/Remove/Clear` 본문(모달 진입/CLEAR 즉시) | `events/handlers/buttons/alertRegionEditHandlers.ts`, `events/listeners/buttons/subscribe*.ts` | §2.5, §2.3 |
| 6 | 모달 제출 리스너 신규 + `modalHandler` 등록 (`:ADD`/`:REMOVE` 키) + 모달 customId 상수화 | `events/listeners/buttons/onRegionSelectModal.ts`, `events/handlers/modals/index.ts` | §2.5, §3.2 |
| 7 | 모달 빌더 customId 접미사 분기(`alarm-subscribe-modal:ADD|REMOVE`) 정본 단일화 | `providers/discord/builder/modals/` (정본) | §2.5, 결정 b |
| 8 | 잔재 #B 5개 파일 삭제 + `index.ts` 재export 제거 + `features/CLAUDE.md` 갱신 + grep 0건 | `features/alarmSubscribe/{handlers,interactions}/`, `index.ts` | §2.9 |
| 9 | TypeScript 컴파일 + 수동 플로우 검증 | — | §6 |

> 1번(잔재 #A)을 최우선 — 렌더 throw가 다른 검증을 막기 때문. 7·8번(중복 단일화·삭제)은 동일 do 단위로 묶음.

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] `providerLogger`/`createLogger` 사용 (console.log 금지)
- [ ] `SystemError.firestoreError` 패턴 준수 (Store 호출 래핑)
- [ ] `eventBus.emitEvent<T>(EventType.X, payload)` 타입 안전 발행
- [ ] `MessageFlags.Ephemeral` 통일 (deprecated `ephemeral: true` 금지)
- [ ] JSDoc 주석 (public 서비스 메서드)
- [ ] 핸들러 → 서비스 → Store 단방향 (핸들러의 Store 직접 호출 금지)
- [ ] 한국어 주석 (필요 시)

---

## 6. 테스트 계획 (수동 검증)

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 전체 컴파일 | `npx tsc --noEmit` (functions/) | 신규 에러 0 |
| 잔재 #A 렌더 | 지역 편집 화면 진입 | 버튼 3개 정상 렌더(throw 없음), CLEAR 클릭 시 초기화 도달 |
| 신규 구독 (ALL) | `/alarm-subscribe`→ENABLE→ALL | Firestore `settings` 생성, `enabled=true, alertMode=ALL`, `NOTIFICATION_SUBSCRIBE` 발행 |
| 신규 구독 (SELECTED)+지역추가 | SELECTED→ADD 모달 "서울" 제출 | `regions:["seoul"]`, `formatRegionList` "현재 선택 지역: 서울" |
| 지역 추가 한도 | regions 2개 상태에서 ADD | "최대 2개까지" ephemeral 에러, 미저장 |
| 잘못된 지역 입력 | 모달에 "ㅁㄴㅇ" 제출 | "지원하지 않는 지역" ephemeral 에러 |
| 지역 제거 | REMOVE 모달 제출 | 해당 지역 제거, 목록 갱신 |
| 초기화 | CLEAR 클릭 | `regions:[]`, "선택된 지역이 없습니다." |
| 모드 변경 | 기존 ALL→SELECTED | `updateMode` 반영, 이벤트 미발행(설정 변경) |
| 구독 관리 조회 | MANAGE | 현재 설정 Embed 표시, 미설정 시 안내 |
| 해제 | unsubscribe 경로 | `enabled=false`, `NOTIFICATION_UNSUBSCRIBE` 발행; 미존재 사용자는 no-op |
| NOT_FOUND 방어 | 문서 없는 상태에서 부분 업데이트 경로 | `ensureExists`로 기본 문서 생성 후 정상 동작, NOT_FOUND throw 없음 |
| 잔재 #B 삭제 | `grep` 5개 파일 참조 | 잔여 import 0건, 컴파일 정상 |

---

## 7. 추가 설계 (2026-05-26) — SelectMenu 2단계 지역 선택 + 발견 1/2

> **추가 배경**: runtime verification 준비 중, 지역 선택이 **모달 텍스트 입력**(한글 직접 타이핑) 방식이라 오타·발견성 약점이 드러났다. 75개 시 중 유효 지역을 강제로 고르게 하려면 SelectMenu가 적합하나, 단일 SelectMenu는 옵션 25개 한계 < 75개 → **권역(10) → 시(≤19) 2단계 SelectMenu**로 설계한다. Discord엔 cascading 위젯이 없으므로 **컴포넌트 교체(2회 인터랙션)** 패턴으로 구현한다.
>
> **대체 관계**: 본 §7은 §1.2 다이어그램 하단(ADD/REMOVE→모달), **§2.5 모달 제출 핸들러**, §4 구현순서 6·7행을 **대체(supersede)**한다. 모달 텍스트 입력 경로는 철거된다. §2.8(#A 버튼 fix), §2.1~2.4·2.6(서비스·모드 핸들러)는 그대로 유효.

### 7.1 데이터 — 권역 그룹 노출 (`functions/src/common/constants/city.ts`)

내부 그룹 const(`MetropolitanCities` 등 10개)는 현재 비공개. 권역 메뉴/시 메뉴 구성을 위해 그룹 구조를 export 한다:
```typescript
export const CITY_GROUPS = {
  metropolitan: { label: "광역시", cities: MetropolitanCities },
  gyeonggi:     { label: "경기",   cities: GyeonggiCities },
  gangwon:      { label: "강원",   cities: GangwonCities },
  chungbuk:     { label: "충북",   cities: ChungbukCities },
  chungnam:     { label: "충남",   cities: ChungnamCities },
  jeonbuk:      { label: "전북",   cities: JeonbukCities },
  jeonnam:      { label: "전남",   cities: JeonnamCities },
  gyeongbuk:    { label: "경북",   cities: GyeongbukCities },
  gyeongnam:    { label: "경남",   cities: GyeongnamCities },
  jeju:         { label: "제주",   cities: JejuCities },
} as const;
export type CityGroupKey = keyof typeof CITY_GROUPS;
```
- 각 `cities`는 `{ [CityEn]: 한글 }` 부분집합. 기존 `CITIES`(flat)·`CityEn` union은 변경 없음.

### 7.2 customId 스킴 (StringSelectMenu, 키 일치 라우팅)

| customId | 용도 | 선택값(`values[0]`) |
|----------|------|---------------------|
| `region-group-select` | 권역 선택 (1단계) | `CityGroupKey` |
| `region-city-select` | 시 선택 (2단계, 추가) | `CityEn` |
| `region-remove-select` | 제거할 지역 선택 | `CityEn` |

- 시 메뉴 선택값이 곧 `CityEn`이라 그룹 컨텍스트를 customId에 실을 필요 없음(2단계 메뉴는 1단계 핸들러가 해당 권역 도시들로 빌드).
- 라우팅은 모달과 동일하게 `isValidFullActionId` 게이트 **밖** — `selectMenuHandlers[customId]` 키 일치.

### 7.3 라우팅 (`functions/src/events/onInteraction.ts`)

`isStringSelectMenu()` 분기 신규(현재 L50 "도입 예정" 주석 → 실제 구현, 주석 제거):
```typescript
if (interaction.isStringSelectMenu()) {
  const handler = selectMenuHandlers[interaction.customId];
  if (handler) await handler(interaction as StringSelectMenuInteraction);
  return;
}
```
- `functions/src/events/handlers/selectMenus/index.ts` 신규 — `selectMenuHandlers: Record<string, (i: StringSelectMenuInteraction) => unknown>` 맵.

### 7.4 빌더 신규 (`functions/src/providers/discord/builder/selectMenus/`)

| 빌더 | customId | 옵션 | placeholder |
|------|----------|------|-------------|
| `regionGroupSelectMenu()` | `region-group-select` | `CITY_GROUPS` 10개 (label=한글 권역, value=groupKey) | "권역을 선택하세요" |
| `regionCitySelectMenu(groupKey)` | `region-city-select` | `CITY_GROUPS[groupKey].cities` (label=한글, value=CityEn) | "시를 선택하세요" |
| `regionRemoveSelectMenu(regions)` | `region-remove-select` | `regions` (label=`CITIES[r]`, value=r) | "제거할 지역을 선택하세요" |

- 각 `ActionRowBuilder<StringSelectMenuBuilder>`, `minValues 1 / maxValues 1`. 누적 상한은 핸들러 서버 체크로 enforce(아래).

### 7.5 핸들러 신규 (`functions/src/events/listeners/selectMenus/`)

```typescript
// 1단계: 권역 → 시 메뉴로 컴포넌트 교체 (서비스 호출 없음 → update 즉시)
onRegionGroupSelect(i): groupKey = i.values[0] as CityGroupKey
  → i.update({ content: "시를 선택하세요", components: [regionCitySelectMenu(groupKey)] })

// 2단계: 시 추가 (Firestore 접근 → deferUpdate 후 editReply)
onRegionCitySelect(i): await i.deferUpdate(); cityEn = i.values[0] as CityEn
  sub = getSubscription(userId); current = sub?.regions ?? []
  if current.includes(cityEn)        → editReply("이미 추가된 지역이에요." + [편집버튼])
  if current.length >= MAX_REGION_COUNT → editReply(`최대 ${MAX_REGION_COUNT}개까지...` + [편집버튼])
  else updated = updateRegions(userId, [...current, cityEn])
       → editReply(formatRegionList(updated.regions) + [alertRegionEditButtons(true)])

// 제거: deferUpdate 후 editReply
onRegionRemoveSelect(i): await i.deferUpdate(); cityEn = i.values[0] as CityEn
  current = getSubscription().regions; updated = updateRegions(current.filter(r=>r!==cityEn))
  → editReply(formatRegionList(updated.regions) + [alertRegionEditButtons(true)])
```
- `MAX_REGION_COUNT`(=2)는 `features/alarmSubscribe/commands/slashCommand.ts`에서 import(발견 2에서 이 상수는 **유지**).
- 중복/상한 검사 로직은 철거되는 `onRegionSelectModal`에서 그대로 계승.

### 7.6 버튼 진입 변경 (`subscribeAdd`/`subscribeRemove`)

- `subscribeAdd`: 모달 진입 → **권역 메뉴 노출**로 변경. `interaction.update({ content:"권역을 선택하세요", components:[regionGroupSelectMenu()] })` (ButtonInteraction, defer 불요).
- `subscribeRemove`: 현재 지역 조회 후 제거 메뉴 노출. `deferUpdate` → `getSubscription` → 지역 0개면 `editReply("제거할 지역이 없어요." + [편집버튼])`, 있으면 `editReply({ components:[regionRemoveSelectMenu(regions)] })`.
- `subscribeClear`(CLEAR): **변경 없음**(`updateRegions(userId, [])`).
- 어댑터(`alertRegionEditHandlers`)·`onAlertRegionEdit` switch 구조 유지, 본문만 위와 같이 교체. ADD/REMOVE payload의 `region?`/`mode`는 미사용화 → 정리 가능(선택).

### 7.7 모달 경로 철거 (삭제)

| 파일 | 처리 |
|------|------|
| `functions/src/providers/discord/builder/modals/regionSelectModal.ts` | **삭제** |
| `functions/src/events/listeners/buttons/onRegionSelectModal.ts` | **삭제** |
| `functions/src/features/alarmSubscribe/constants/alarmSubscribeModalId.ts` | **삭제** |
| `functions/src/events/handlers/modals/index.ts` | `alarmSubscribeModalId.ADD/REMOVE` 등록 제거. 다른 모달 의존 없으면 빈 맵 유지(라우팅 골격은 보존) |
| `constants/index.ts` | `alarmSubscribeModalId` export 제거 |

> 삭제 전 grep으로 잔여 import 0건 확인. `MessageFlags`·`koToCityEn` 등 공용 헬퍼는 SelectMenu 핸들러에서 계속 쓰일 수 있으니 사용처 확인 후 판단.

### 7.8 발견 1 — `/alarm-subscribe`의 dead `모드` 필수 옵션 제거

**파일**: `functions/src/providers/discord/builder/commands/slash/alarmSubscribe.ts` (실제 등록본)
- `.addStringOption(모드...)` + `subscribeChoices` + 미사용 import(`APIApplicationCommandOptionChoice`, `AlertMode`, `SubscribeCommand`) 제거. `.setName`/`.setDescription`만 유지 → 인자 없는 진입점.
- 이 파일의 dead `MAX_REGION_COUNT`(import처 0건) 제거.
- ⚠️ **반영 후 `npm run register:commands` 재실행 필요**(옵션 제거를 Discord에 푸시) — 사용자 수행.

### 7.9 발견 2 — 커맨드 정의·`MAX_REGION_COUNT` 중복 정리

**파일**: `functions/src/features/alarmSubscribe/commands/slashCommand.ts`
- dead `alarmSubscribeCommand` + `subscribeChoices` + 미사용 import 제거. **`MAX_REGION_COUNT`는 유지**(7.5 핸들러가 import하는 SoT).
- `functions/src/features/alarmSubscribe/index.ts` barrel: `alarmSubscribeCommand` 재export 제거, `MAX_REGION_COUNT`만 유지.

### 7.10 테스트 계획 보강 (§6 대체분)

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 전체 컴파일 | `npx tsc --noEmit` | 신규 에러 0 |
| 커맨드 진입 | `/alarm-subscribe` | 인자 입력 없이 즉시 실행([알림 켜기][설정 관리]) |
| 지역 추가 2단계 | SELECTED→➕추가→권역"경기"→시"수원" | `regions:["suwon"]`, 목록 갱신 |
| 권역→시 교체 | 권역 선택 | 같은 메시지가 해당 권역 시 메뉴로 교체됨 |
| 추가 한도 | regions 2개 상태에서 시 선택 | "최대 2개까지" 안내, 미저장 |
| 지역 제거 | ➖제거→제거 메뉴에서 선택 | 해당 지역 제거, 목록 갱신 |
| 제거 대상 없음 | regions 0개에서 ➖제거 | "제거할 지역이 없어요." |
| 모달 잔재 | grep `regionSelectModal`/`onRegionSelectModal`/`alarmSubscribeModalId` | 참조 0건, 컴파일 정상 |

---

## 8. 추가 설계 (2026-05-26) — 진입/관리 UX 개선 (#1·#2·#3)

> 출처: `docs/user-memo.md`. 사용자 결정으로 Phase 1.5 2차 확장. **§2.6(onShowSubscribeManage)·§2.7(UI 헬퍼) 일부를 대체**한다.
> 서비스/스토어/타입 변경 없음 — 기존 `alarmSubscriptionService` 메서드만 재사용.

### 8.1 진입 상태 분기 + on/off 토글 (#1)

- **신규** `providers/discord/builder/subscribeEntryView.ts` — `buildSubscribeEntryView(sub: AlarmSubscription | null): { content; components }`.
  - 켜짐+ALL → `🔔 알림 켜짐 · 🌐 전체 지역` / 켜짐+SELECTED → `🔔 알림 켜짐 · 📍 {formatRegionList}` / 꺼짐 → `🔕 알림 꺼짐...` / 미설정 → 기존 시작 안내.
- **수정** `builder/buttons/showSubscribeOptionButtons.ts` → `(sub)` 인자로 좌측 버튼 분기: 켜짐=[🔕 알림 끄기(DISABLE)], 그 외=[🔔 알림 켜기(ENABLE)]. 우측 [⚙️ 설정 관리(MANAGE)] 고정.
- **수정** `listeners/commands/onAlarmSubscribe.ts` → `getSubscription` 후 `buildSubscribeEntryView`로 `reply`.
- **신규 리스너** `onDisableSubscribe.ts`(DISABLE): `deferUpdate`→`unsubscribe`→진입 뷰 복귀(`embeds:[]`).
- **재진입(OFF→ON)**: 비활성 시 좌측은 ENABLE → `onShowSubscribeEnable` 상태 분기.
  - **[정정 2026-05-27]** 당초 "모드 선택 흐름으로 `enabled:true` 복귀, 신규 enable 메서드 불요"로 설계했으나 **오류**였다 — 기존 문서 보유 상태의 ENABLE은 `updateMode`(alertMode만 갱신)로 분기해 `enabled:false`가 잔존했다(런타임 검증 R2, "켜기를 눌러도 켜짐으로 안 바뀜"). 전용 `resubscribe()` 신설로 해결: **기존 데이터면 모드 재선택 없이 `toggleNotificationEnabled(true)`로 즉시 재활성화 후 진입 뷰(켜짐) 복귀, 미설정만 모드 선택 흐름**. 상세: analysis §3.3 R2.

### 8.2 설정 관리에서 모드 변경 (ALL⇄SELECTED) — 고아 자산 재활용 (#2)

- **신규** `regionModeChangeActionId.OPEN`(`REGION_MODE_CHANGE:OPEN`) + `fullActionId.REGION_MODE_CHANGE_OPEN`.
- **신규 리스너** `onChangeRequest.ts`(OPEN): `deferUpdate`→`getUserAlertMode`(null→ALL)→확인 프롬프트 + 기존 `showConfirmChangeAlertModeButtons()`.
- **수정** `onChangeConfirm.ts`: 토글(`updateMode` 반환값) 후 막다른 메시지 대신 **관리 화면 재렌더**.
- **수정** `onChangeCancel.ts`: `deferUpdate`→`getSubscription`→**관리 화면 복귀**(미설정 시 안내).

### 8.3 설정 관리 뒤로가기 (#3)

- **신규** `subscribeOptionActionId.BACK`(`SUBSCRIBE_OPTION:BACK`) + `fullActionId.SUBSCRIBE_OPTION_BACK`.
- **신규 리스너** `onSubscribeBack.ts`(BACK): `deferUpdate`→`getSubscription`→`buildSubscribeEntryView` 진입 화면 복귀(#1 헬퍼 재사용).

### 8.4 관리 버튼 통합 + 공유 렌더

- **신규** `builder/buttons/subscribeManageButtons.ts` — Row1 [🔀 모드 변경(OPEN)][⬅️ 뒤로(BACK)], SELECTED일 때 Row2 `alertRegionEditButtons(true)`.
- **신규** `listeners/buttons/renderSubscribeManage.ts` — `renderSubscribeManage(interaction, sub)` = Embed + 관리 버튼 `editReply`(deferUpdate 전제). `onShowSubscribeManage`·`onChangeConfirm`·`onChangeCancel` 공유.
- **수정** `onShowSubscribeManage.ts`: `renderSubscribeManage` 사용으로 단순화(미설정 분기 유지).

### 8.5 customId/라우팅 추가

- `subscribeOptionAction.ts`: enum +`DISABLE`,`BACK`. `regionModeChangeAction.ts`: enum +`OPEN`.
- `fullActionId.ts`: +`SUBSCRIBE_OPTION_DISABLE`,`SUBSCRIBE_OPTION_BACK`,`REGION_MODE_CHANGE_OPEN` (게이트 `isValidFullActionId` 통과 필수).
- 레지스트리: `showSubscribeOptionHandler`(+DISABLE,BACK), `regionModeChangeConfirmHandlers`(+OPEN).

### 8.6 테스트 계획 보강 (runtime verification G1~G10)

`03-analysis.md` 런타임 검증 체크리스트 G 항목으로 통합. 재analyze 생략(사용자 결정) → 런타임 검증으로 갈음. 정적: tsc 0(기본+build), 게이트 3종 등록 확인.

---

## 설계 결정 요약 (a~g)

| 항목 | 결정 | 근거 |
|------|------|------|
| **(a)** `regionModeChangeButtons` 신규 vs 재사용 | **기존 `showConfirmChangeAlertModeButtons()` 재사용**(신규 안 만듦) | 동일 역할·동일 customId·동일 스타일. 중복 빌더 회피 |
| **(b)** 모달 ADD/REMOVE 구분 | **안 A — customId 접미사 분기** `alarm-subscribe-modal:ADD`/`:REMOVE`, `modalHandler` 키 분기 | 버튼 customId 패턴(`PREFIX:ACTION`)과 일관, 제출 시 명확 구분, 상태 추론 불요 |
| **(c)** `onAlertRegionEdit` ↔ `buttonHandlers` 시그니처 불일치 | **어댑터 배선** — `alertRegionEditHandlers` 각 키가 `(interaction) => onAlertRegionEdit({action, payload})` | `notImplemented` 제거, payload 조립을 어댑터가 담당. ADD/REMOVE는 모달 진입, CLEAR만 즉시 서비스 호출 |
| **(d)** `modalHandler` 빈 객체 | **`:ADD`/`:REMOVE` 2키 등록** → `onRegionSelectModal`(신규 리스너) | 모달 customId는 `isValidFullActionId` 밖이라 키 일치로 라우팅 |
| **(e)** 중복 `showSubscribeOptionButtons` | **`providers/.../showSubscribeOptionButtons.ts`(setStyle 有)로 통일**, `interactions/buttons.ts` 삭제(#B) | live 진입점이 이미 providers 버전 사용, interactions 버전은 setStyle 없어 렌더 throw 위험 |
| **(f)** ephemeral 통일 | **`MessageFlags.Ephemeral` 전면 통일**, 개인 데이터 ephemeral 기본 | deprecated `ephemeral:true` 제거, 개인 설정 노출 최소화 |
| **(g)** 잔재 #A 버그 | **setStyle 2건 추가(ADD=Success, REMOVE=Secondary) + CLEAR customId 교정 + setDisabled 반전(`!isSelectedRegionMode`)** | §2.8 표. 렌더 throw·CLEAR 도달 불가·비활성 논리 반전 동시 해결 |

---

*작성일: 2026-05-25*
*참고: docs/phase-1-5/01-plan.md*

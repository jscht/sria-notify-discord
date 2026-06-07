# Phase 1.5: 알림 설정 UI 완성 (notification-settings-ui)

**상태**: 🔄 진행 중
**우선순위**: P0
**의존성**: phase-1-4-notification-store (archived, matchRate 100%)

---

## 개요

### 배경
`/alarm-subscribe` live 경로의 핵심 버튼/모달 핸들러가 `throw "not yet implemented (Phase 1.5)"` 상태이고,
서비스 본문(`AlarmSubscriptionService`) 6개 메서드도 스텁(throw/null)이다. Phase 1.4에서
`SubscriptionStore`(Firestore 저장소)가 완성되었으므로, 이를 호출하는 서비스·핸들러 계층을 완성해야
알림 설정 기능이 실제로 동작한다.

동시에 Phase 1.12 책임 기반 개편 이전 구조의 **중복 잔재 파일 5개**
(`features/alarmSubscribe/handlers/{commandHandler,buttonHandler,modalHandler}.ts`,
`features/alarmSubscribe/interactions/{buttons,modals}.ts`)가 남아 문서-코드 드리프트를 만들고 있다.

### 목표
- `/alarm-subscribe` 전체 플로우(모드 선택 → 지역 편집 → 확정 → Firestore 저장)가 end-to-end 동작
- 설정 변경/해제 시 EventBus 이벤트 발행으로 후속 Phase(1.7 자동 알림)와 연계 기반 확보
- Phase 1.12 정본 구조로 잔재 정리 → 드리프트 제거

### 범위

| 포함 | 제외 |
|------|------|
| `AlarmSubscriptionService` 6개 메서드 본문 구현 | 신규 Firestore 스키마 (Phase 1.4에서 완료) |
| throw 상태 버튼/모달 핸들러 구현 (live 경로) | 자동 알림 발송 로직 (Phase 1.7) |
| UI 헬퍼(`regionModeChangeButtons`, `formatRegionList`) 신규 | 자연어/AI 처리 (Phase 4) |
| 설정 변경/해제 이벤트 발행 | DM 발송 유틸 (Phase 1.8) |
| 잔재 #A 버그 fix (`alertRegionEditButtons.ts`) | 권한/인증 변경 |
| 잔재 #B 삭제 (5개 파일 + barrel·문서 동반 수정) | |

---

## 요구사항

### 기능 요구사항
> **SoT 주의**: 시드(`phase-1-core.md`)·`features/CLAUDE.md`는 옛 `notificationSettingsService`/
> `getUserAlertMode/setUserAlertMode` 명칭을 쓰나, **실제 코드(SoT)는 `AlarmSubscriptionService`**
> (`getUserAlertMode/subscribe/unsubscribe/updateMode/updateRegions/getSubscription`). 코드 기준으로 구현한다.

1. **서비스 본문** — `AlarmSubscriptionService` 6개 메서드를 `SubscriptionStore`(Phase 1.4) 호출로 구현.
   CQS 계약 준수: `set*`은 void, 부분 업데이트(`updateAlertMode/Regions`, `toggle`)는 문서 선존재 전제.
2. **throw 핸들러 구현** (`events/listeners/buttons/`):
   - `onEnableAllRegionAlert` (ALERT_MODE:ALL) → ALL 모드 설정·활성화
   - `onEnableSelectedRegionAlert` (ALERT_MODE:SELECTED) → SELECTED 모드 + 지역 편집 UI 진입
   - `onShowSubscribeManage` (SUBSCRIBE_OPTION:MANAGE) → 현재 설정 표시 + 관리 UI
   - `onChangeConfirm` (REGION_MODE_CHANGE:CONFIRM) → 모드 변경 확정
   - `subscribeAdd/Remove/Clear` (REGION_EDIT:*) + `events/handlers/buttons/alertRegionEditHandlers.ts`
     맵을 `notImplemented` → 실제 dispatcher로 배선
3. **모달 제출 처리** — 지역 추가/제거 모달 핸들러 완성 (live 경로 모달 라우팅 확인 후).
4. **UI 헬퍼 신규** — `providers/discord/builder/buttons/`에 `regionModeChangeButtons()`,
   `formatRegionList(regions)` 추가 (현재 `showAlertModeSelectButtons`만 존재).
5. **이벤트 발행** — 설정 변경 시 `notification.subscribe`, 해제 시 `notification.unsubscribe`.
6. **잔재 #A 버그 fix** — `providers/discord/builder/buttons/alertRegionEditButtons.ts`:
   ADD/REMOVE 버튼 `.setStyle()` 누락 추가 + "🧹 초기화" 버튼이 `alertRegionEditActionId.ADD`로
   잘못 배선된 것을 `.CLEAR`로 교정 (현재 Clear 도달 불가).
7. **잔재 #B 삭제** — 5개 파일 삭제 + `index.ts` 재export 5줄 제거 + `features/CLAUDE.md` 옛 구조 그림 갱신.

### 비기능 요구사항
- **성능**: 부분 업데이트는 `update()`로 최소 쓰기, 불필요한 `get()` 라운드트립 회피
- **호환성**: 기존 `SubscriptionStore` CQS 계약·`AlarmSubscription` 타입 유지, live 인터랙션 흐름 보존
- **에러 처리**: SystemError 패턴 준수, NOT_FOUND 등 Firestore 에러 방어

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js 14.17 |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식
- **계층 책임 (Phase 1.12 정본)**: Discord 라우팅·핸들링 = `events/`(handlers→listeners),
  UI 빌더 = `providers/discord/builder/`, 기능 서비스·상수·타입 = `features/`.
- 서비스 → `SubscriptionStore` 단방향 호출. 핸들러는 서비스를 경유(직접 store 호출 금지).
- **CQS 시퀀스**: `subscribe`는 `setNotificationSettings`(생성/덮어쓰기) 선행 → 이후 `update*` 가능.
  부분 업데이트만 단독 호출 시 문서 미존재면 NOT_FOUND → 서비스가 선존재 보장 로직 담당.

### 영향 받는 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `features/alarmSubscribe/services/subscriptionService.ts` | 수정 | `AlarmSubscriptionService` 6개 메서드 본문 |
| `events/listeners/buttons/onEnableAllRegionAlert.ts` 외 throw 핸들러 | 수정 | 실제 로직 구현 |
| `events/handlers/buttons/alertRegionEditHandlers.ts` | 수정 | notImplemented → dispatcher 배선 |
| `providers/discord/builder/buttons/alertRegionEditButtons.ts` | 수정 | 잔재 #A 버그 fix |
| `providers/discord/builder/buttons/` (신규 헬퍼) | 신규 | `regionModeChangeButtons`, `formatRegionList` |
| `events/bus/types.ts` (이벤트 페이로드) | 확인/수정 | `notification.subscribe/unsubscribe` 페이로드 |
| `features/alarmSubscribe/{handlers/3, interactions/2}` | **삭제(#B)** | 개편 이전 잔재 |
| `features/alarmSubscribe/index.ts` | 수정 | 재export 5줄(L10·11·14·15·16) 제거 |
| `features/CLAUDE.md` | 수정 | 옛 구조 그림 갱신 |

### 의존성 분석
- **의존 대상**: `phase-1-4-notification-store`의 `SubscriptionStore`(완료), `@/common/types`(`AlarmSubscription`/`AlertMode`)
- **후속 의존**: `phase-1-7-auto-notification-system`, `phase-1-9-scheduler-reactivation`가 본 Phase에 의존

---

## 위임 계획 (CTO Lead 승인 — 2026-05-25)

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|-------------|
| design.md 작성 (주관) | **Integration Lead** | 무게중심이 서비스 본문·이벤트 발행·CQS 오케스트레이션, UI는 얇은 층 | `02-design.md` — 서비스↔Store 호출 매핑, CQS 시퀀스(set→get), 이벤트 발행 지점, 핸들러↔서비스 배선도 |
| Discord UI/인터랙션 설계 입력 | **Discord Agent** (design 협업) | throw 핸들러 8건·모달 제출·UI 헬퍼·잔재 #A는 discord.js 도메인 | UI 컴포넌트·인터랙션 흐름, customId 라우팅 매핑 |
| 데이터 계약 검토 (보조·선택) | Backend Expert | CQS 부분 업데이트 NOT_FOUND 선존재 전제 계약 확인, 신규 스키마 없음 → 경량 리뷰 | `§데이터 계약`에 NOT_FOUND 방어 패턴 코멘트 |

> AI Agent·Frontend Architect·Security Architect는 이번 사이클 범위 밖 (NLP 없음, 신규 UX 설계 아님, 권한 변경 없음).

---

## 성공 기준

- [ ] `AlarmSubscriptionService` 6개 메서드 `SubscriptionStore` 경유 구현, CQS 계약 준수
- [ ] throw 핸들러 7건 + `alertRegionEditHandlers` 3건 실제 동작
- [ ] `/alarm-subscribe` 전체 플로우(모드 선택 → 지역 편집 → 확정) Firestore 저장 확인
- [ ] 설정 변경/해제 시 `notification.subscribe/unsubscribe` 이벤트 발행
- [ ] 잔재 #A 버그 fix (ADD/REMOVE setStyle + Clear customId 교정)
- [ ] 잔재 #B 5개 파일 삭제 + barrel·문서 동반 수정, 잔여 참조 grep 0건
- [ ] TypeScript 컴파일 성공 (`npx tsc --noEmit`, 신규 에러 0)
- [ ] 기존 기능 정상 동작 확인

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| CQS 위반 — 부분 업데이트가 문서 선존재 없이 `update()` 호출 시 Firestore NOT_FOUND | 높음 | design에 "subscribe = set 선행 → update" 시퀀스 명문화, 서비스가 선존재 보장 |
| 잔재 #B 삭제 순서 — 파일 삭제와 `index.ts` 재export 제거 분리 시 컴파일 붕괴 + dangling export | 중간 | 파일 삭제 + index.ts 편집을 동일 do 단위로 묶음 |
| 명칭 드리프트 — 시드·`features/CLAUDE.md`가 옛 `notificationSettingsService` 명칭 사용 | 낮음 | design은 실제 `AlarmSubscriptionService` 기준, `features/CLAUDE.md` 갱신을 do 범위에 포함 |

---

*작성일: 2026-05-25*
*시드: .claude/phases/phase-1-core.md*

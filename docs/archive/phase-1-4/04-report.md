# Phase 1.4 완료 보고서: phase-1-4-notification-store

**상태**: ✅ 완료 (검토 승인: 2026-05-25)
**작성일**: 2026-05-24
**PDCA 사이클**: plan → design → do → analyze → report

---

## 1. 요약

### 1.1 개요
| 항목 | 내용 |
|------|------|
| 기능명 | Notification Store — AlarmSubscription 도메인 타입 단일화 + SubscriptionStore CRUD 구현 |
| Phase | 1.4 |
| 시작일 | 2026-05-13 |
| 완료일 | 2026-05-24 |
| 최종 매치율 | **100.0%** |
| Critical 갭 | **0건** |
| 분석 후 적용 개선 | 2건 (부분 업데이트 `update()` 전환, `setNotificationSettings` CQS 적용) |

### 1.2 목표 달성

| 목표 | 달성 | 비고 |
|------|------|------|
| `AlarmSubscription` 타입 단일화 (`common/types/`로 이동) | ✅ | canonical `AlertMode` const + 파생 union + `AlarmSubscription` 인터페이스 |
| `AlertModeSelectAction` enum 폐기 → `AlertMode` const 참조 전환 | ✅ | 8개 사용처 + JSDoc 1건 일괄 갱신 |
| `SubscriptionStore` 6개 메서드 구현 (CRUD + 활성 구독자 조회) | ✅ | get/set/updateMode/updateRegions/toggle/getAllActiveSubscribers |
| `getAllActiveSubscribers()` 구현으로 Phase 1.7 기반 마련 | ✅ | collectionGroup + `enabled==true` 필터 + `userId` 추출 |
| TypeScript 컴파일 성공 (`tsc --noEmit` exit 0) | ✅ | 신규 에러 0건 |
| 단일화 grep 검증 (`interface AlarmSubscription` 1건 / `AlertModeSelectAction` 0건 / `SELECTED_REGIONS` 0건) | ✅ | 모두 달성 |

---

## 2. 구현 요약

### 2.1 주요 변경사항

#### 2.1.1 신규 Canonical 도메인 타입 (`common/types/alarmSubscription.ts`)
- **AlertMode**: `{ ALL, SELECTED } as const` + 파생 `typeof AlertMode[keyof typeof AlertMode]` union — 값 1곳 수정으로 전 사용처 자동 갱신, 트리쉐이킹 가능
- **AlarmSubscription**: 6필드(userId, enabled, alertMode, regions, createdAt, updatedAt). timestamps는 `number`(ms) — Firestore `Timestamp` 변환은 store가 전담
- **AlarmSubscriptionInput**: `Pick<AlarmSubscription, "enabled" | "alertMode" | "regions">`

#### 2.1.2 EventBus 타입 중복 제거
- `events/bus/types.ts` 내 `AlertMode`/`AlarmSubscription` 정의(L100-112) 삭제 → `@/common/types` type import
- `NotificationSubscribeEvent`/`NotificationSendEvent` 페이로드가 canonical 타입 단일 참조 (이중 정의 0건)

#### 2.1.3 enum 폐기 + UI customId 빌더 갱신
- `constants/alertModeSelectAction.ts`: enum 제거, `alertModeSelectActionId`가 `AlertMode` 직접 참조 → `"ALERT_MODE:ALL"`, `"ALERT_MODE:SELECTED"` (기존 `SELECTED_REGIONS` 정규화)
- `types/alarmSubscribeCommand.ts`: `SubscribeCommand`을 `AlertMode` 별칭으로, `CommandActionMap` 키 리터럴화
- 사용처 8건 일괄 갱신: `commands/slashCommand.ts`, `ai/interpreter.ts`, `events/listeners/buttons/`(4건), `providers/discord/builder/commands/slash/alarmSubscribe.ts`

#### 2.1.4 SubscriptionStore 클래스 구현 (`providers/firebase/store/subscription.ts`, 신규)
| 메서드 | 반환 | 동작 |
|--------|------|------|
| `getNotificationSettings(userId)` | `AlarmSubscription \| null` | 문서 없으면 null (자동 생성 X) |
| `setNotificationSettings(userId, input)` | `void` (CQS 쓰기 전용) | 신규: createdAt+updatedAt 기록 / 기존: updatedAt만 갱신, createdAt 보존 (`set(merge:true)`) |
| `updateAlertMode(userId, alertMode)` | `void` | `update()` 부분 업데이트 (문서 없으면 NOT_FOUND throw) |
| `updateAlertRegions(userId, regions)` | `void` | `update()` 부분 업데이트 |
| `toggleNotificationEnabled(userId, enabled)` | `void` | `update()` 부분 업데이트 |
| `getAllActiveSubscribers()` | `AlarmSubscription[]` | `collectionGroup('notifications') + where('enabled','==',true)` + settings 필터 + userId 추출 |

- `Timestamp ↔ number` 변환을 `toAlarmSubscription` 헬퍼에 격리
- `getSettingsRef()` private getter로 경로 일관화: `users/{userId}/notifications/settings`
- `ProxyStore` 패턴 준수: `private readonly db = getFirestore()`, `providerLogger` 사용

#### 2.1.5 컬렉션 enum 확장 / export
- `constants/collections.ts`: `USERS = "users"`, `NOTIFICATIONS = "notifications"` 추가
- `store/index.ts`: `SubscriptionStore` export 추가

#### 2.1.6 subscriptionService 시그니처 정합화 (본문 미구현 — Phase 1.5 범위)
- 6개 메서드 시그니처를 `AlertMode`/`CityEn[]`/`AlarmSubscription`/`AlarmSubscriptionInput`로 정합화. 본문은 `throw`/`return null` 유지

### 2.2 파일 변경 목록

| 파일 | 변경 유형 |
|------|----------|
| `common/types/alarmSubscription.ts` | 신규 |
| `common/types/index.ts` | 수정 |
| `events/bus/types.ts` | 수정 |
| `features/alarmSubscribe/types/alarmSubscription.ts` | 삭제 |
| `features/alarmSubscribe/types/index.ts` | 수정 |
| `features/alarmSubscribe/constants/alertModeSelectAction.ts` | 수정 |
| `features/alarmSubscribe/constants/index.ts` | 수정 |
| `features/alarmSubscribe/types/alarmSubscribeCommand.ts` | 수정 |
| `features/alarmSubscribe/services/subscriptionService.ts` | 수정 |
| `features/alarmSubscribe/commands/slashCommand.ts` | 수정 |
| `features/alarmSubscribe/ai/interpreter.ts` | 수정 |
| `features/alarmSubscribe/constants/fullActionId.ts` | 수정 |
| `events/listeners/buttons/onChangeConfirm.ts` | 수정 |
| `events/listeners/buttons/onEnableSelectedRegionAlert.ts` | 수정 |
| `events/listeners/buttons/onShowSubscribeManage.ts` | 수정 |
| `events/listeners/buttons/subscribeRemove.ts` | 수정 |
| `events/listeners/commands/onAlarmSubscribe.ts` | 수정 |
| `providers/discord/builder/commands/slash/alarmSubscribe.ts` | 수정 |
| `providers/firebase/constants/collections.ts` | 수정 |
| `providers/firebase/store/subscription.ts` | 신규 |
| `providers/firebase/store/index.ts` | 수정 |

**규모**: 신규 2개(`alarmSubscription.ts` ~40L, `subscription.ts` ~134L) + 수정 18개 + 삭제 1개 (총 21개 파일)

---

## 3. 갭 분석 이력

### 3.1 분석 결과 요약

| 분석 회차 | 매치율 | Critical 갭 | 주요 발견 | 적용 상태 |
|----------|--------|------------|----------|----------|
| 1차 (2026-05-24) | 100% | 0건 | 이슈 #1(부분 업데이트 `set(merge:true)`→`update()`), 이슈 #2(`setNotificationSettings` CQS) | ✅ 적용 완료 |

> iterate 미진입 — 1차 analyze에서 매치율 100% 달성. 🟡 Major 2건은 분석 직후 하드닝으로 해소.

### 3.2 주요 갭/이슈 해결 내역

| 항목 | 원인 | 해결 방법 | 적용 |
|------|------|----------|------|
| 이슈 #1: 부분 업데이트가 `set(merge:true)`로 신규 문서 생성 시 `createdAt` 누락 → 조회 throw 위험 | 초안 pseudo-code와 "문서 생성은 setNotificationSettings만" 명시 계약(§2.5)의 모순 | 3개 부분 업데이트 메서드를 `update()`로 전환 → 문서 없으면 NOT_FOUND throw로 계약 런타임 강제 | ✅ 2026-05-24 |
| 이슈 #2: `setNotificationSettings`가 저장 후 재조회(round-trip 3회) | CQS 미적용 + 불필요 read | `Promise<AlarmSubscription>` → `Promise<void>`, 마지막 `get()` 제거(왕복 2회). 저장 후 상태는 호출자가 `getNotificationSettings` 조회 | ✅ 2026-05-24 |

### 3.3 코드 외 검증 보류 (런타임/수동 — 갭 아님)
- `npm run register:commands` 실제 재등록 (빌더 choice value 정합화는 확인됨)
- Firestore Emulator round-trip / collectionGroup 필터링 / 부분 업데이트 동작 (로직은 설계와 일치, 수동 검증 보류)

---

## 4. 검토 사항

**참고 문서**: [review-process.md](../../rules/review-process.md)

> ⚠️ 피드백 수신 시 즉시 반영하지 않음 → 수정 계획 제시 → 사용자 승인 → 진행

### 4.1 코드 리뷰
- [x] 핵심 로직 구현 확인 — `SubscriptionStore` 6개 메서드 설계 정확히 구현
- [x] 타입 안전성 확인 — canonical SoT 단일화, `as const`, `import type` 분리
- [x] 에러 처리 확인 — Firestore 실패 throw 전파, 문서 미존재 정상 처리(`null` / NOT_FOUND)

### 4.2 기능 테스트
- [x] TypeScript 컴파일 성공 — `tsc --noEmit` exit 0 (컴파일 수준 회귀 0건)
- [ ] 런타임 회귀 — Phase 1.3 RecruitCacheService 이벤트 발행 등 수동 트리거 검증 **미실행** (Phase 1.5 착수 시 권장)
- [x] 단일화 grep 검증 — `interface AlarmSubscription` 1건 / `AlertModeSelectAction` 0건 / `"SELECTED_REGIONS"` 0건

### 4.3 문서화
- [x] JSDoc 주석 — `SubscriptionStore` 6개 메서드 + 타입 3종 모두 보유
- [x] 관련 문서 업데이트 — 분석서(§3.2)·설계서(§2.5) 이슈 #1·#2 동반 갱신

---

## 5. 피드백 반영 내역

### [Revision 1] 2026-05-24 — 분석 후 하드닝 2건 (사용자 승인 후 적용)
- **이슈 #1**: 부분 업데이트 `set(merge:true)` → `update()` 전환 (설계 명시 계약 우선). 분석서 §3.2 항목 2, 설계서 §2.5 동반 갱신
- **이슈 #2**: `setNotificationSettings` CQS 적용 → `Promise<void>` 전환. 분석서 §3.2 항목 3, 설계서 §2.5 동반 갱신
- **승인 상태**: 승인됨 / **수정 결과**: 적용 완료, `tsc --noEmit` exit 0 재확인

---

## 6. Process Improvement

### 6.1 잘된 점
- **SoT 단일화의 명확함**: `AlertMode` const 1곳 수정으로 전 사용처 자동 갱신 (enum 메타데이터 제거)
- **타입 경계 명확화**: `Timestamp ↔ number` 변환을 `toAlarmSubscription` 헬퍼에 격리
- **분석 단계 조기 정정**: 설계 명시 계약(문서 생성 전담, CQS)과 구현의 모순을 analyze에서 즉시 발견·해소

### 6.2 개선할 점
- **초안 pseudo-code 계약 정합 점검**: 부분 업데이트의 set vs update 선택을 설계 초안에서 점검했다면 이슈 #1 조기 방지 가능
- **후속 Phase 사용례 문서화**: Phase 1.5/1.7/2.2가 `SubscriptionStore`를 어떻게 호출할지 설계서에 사용례 코드 추가 권장

### 6.3 다음 Phase 제안

| 제안 | 관련 Phase | 우선순위 |
|------|-----------|---------|
| `subscriptionService` 본문 구현 (SubscriptionStore 래핑) + 버튼 핸들러 4건 구현 | Phase 1.5 | P0 |
| `getAllActiveSubscribers()` 활용 자동 알림 발송 | Phase 1.7 | P0 |
| `npm run register:commands` 실행 + Discord 재등록 런타임 검증 | Phase 1.4 후속 | P1 |
| `providers/CLAUDE.md` subscription.ts 예시 갱신 (구형 함수형 → 클래스/CQS 반영) | 문서 | P2 |
| Firestore Emulator 자동화 테스트 | Phase 3 | P2 |

---

## 7. 다음 단계

1. [x] 사용자 피드백 확인 및 승인 (2026-05-25 승인)
2. [x] Git 커밋 (논리적 단위 분리) — PR은 보류
3. [x] pdca-status.json 최종 동기화
4. [ ] `/pdca archive 1.4` 실행 → `docs/archive/phase-1-4/`

---

*작성일: 2026-05-24*
*참고: docs/phase-1-4/01-plan.md, 02-design.md, 03-analysis.md*

# Phase 1.12: Events 아키텍처 통합 🔍

**상태**: 🔍 검토 중 (2026-01-16)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.1 (EventBus 인프라)

---

## 📊 개선 작업 현황

### 폴더 구조 통일 ✅
- eventBus 폴더를 `src/eventBus/` → `src/events/eventBus/`로 이동
- Discord 이벤트 핸들러와 EventBus를 같은 계층(events)에서 관리
- 개념적 응집도 향상 및 구조적 명확성 증대

### 경로 별칭 업데이트 ✅
- tsconfig.json에 새로운 경로 별칭 추가
- `@/events/eventBus` 및 `@/events/eventBus/*` 경로 정의
- import 경로 일관성 보장

### 통합 진입점 설정 ✅
- `events/index.ts`를 EventBus 및 Discord 핸들러의 통합 재export 포인트로 설정
- EventBus 관련 모든 export를 한곳에서 관리

---

## 📝 작업 체크리스트

### 1. 폴더 구조 이동
- [x] `src/eventBus/` 폴더를 `src/events/eventBus/`로 이동
- [x] 폴더 구조 검증

### 2. TypeScript 경로 별칭 업데이트
- [x] `@/events/eventBus` 경로 별칭 추가
- [x] `@/events/eventBus/*` 경로 별칭 추가
- [x] tsconfig.json 검증

### 3. Events 통합 진입점 설계
- [x] EventBus re-export 추가 (eventBus, EventBus)
- [x] EventBus 타입 export 추가
- [x] EventBus 상수 export 추가
- [x] 이벤트 핸들러 등록 유틸 export
- [x] 주석 추가 (Events 레이어 통합 진입점 설명)

### 4. Import 경로 업데이트
- [x] 6개 파일의 import 경로 업데이트
  - errorHandler.ts
  - BaseScheduler.ts
  - firebaseConnCache.ts
  - initFirebaseApp.ts
  - (추가 파일들)

---

## ✅ 완료 기준

- [x] EventBus 폴더 이동 완료
- [x] TypeScript 경로 별칭 정의
- [x] Events 통합 진입점 설정
- [x] Import 경로 업데이트
- [x] TypeScript 컴파일 성공

---

## 📂 생성된 파일 목록

**수정 파일**: 2개
- `functions/tsconfig.json`
- `functions/src/events/index.ts`

**이동된 폴더**:
- `src/eventBus/` → `src/events/eventBus/` (전체 구조)

**총 코드 라인**: ~15 lines (추가/수정)

---

## 🔍 검토 사항

**참고 문서**: [REVIEW_PROCESS.md](./REVIEW_PROCESS.md)

### 아키텍처 리뷰
- [x] 폴더 구조 통일의 논리성 ✅
  - [x] Discord 핸들러와 EventBus가 같은 계층에 위치
  - [x] 개념적 응집도 향상

- [x] 경로 별칭 설정의 완전성 ✅
  - [x] 새 위치에 대한 명시적 별칭 정의
  - [x] 와일드카드 패턴 사용으로 하위 경로 커버

- [x] 통합 진입점 설계의 효율성 ✅
  - [x] EventBus 관련 모든 export를 중앙집중식으로 관리
  - [x] 사용자 입장에서 단일 import 포인트 제공

### 코드 리뷰
- [x] events/index.ts 구조 ✅
  - [x] 주석 명확성
  - [x] Export 순서 (EventBus → Discord 핸들러)
  - [x] 재export 완전성

- [x] tsconfig.json 수정 ✅
  - [x] 경로 별칭 형식 정확성
  - [x] 기존 설정과의 일관성

### 기능 테스트
- [x] TypeScript 컴파일 성공 ✅
- [x] Import 경로 해석 성공 ✅

### 문서화
- [x] JSDoc 주석 (events/index.ts) ✅

---

## 💡 구현 하이라이트

### 1. `events/bus/` - EventBus 인프라 (Event 통신 핵심)

**역할**: 중앙화된 이벤트 허브 (Singleton)
**책임**: 타입 안전 이벤트 emit/subscribe

```
events/bus/
├── EventBus.ts        (Singleton 패턴)
├── types.ts           (이벤트 타입 정의)
├── constants.ts       (이벤트 상수)
└── utils/
    ├── eventLogger.ts
    └── registerEventHandlers.ts
```

- **역할**: `eventBus.emit()` / `eventBus.on()` 제공
- **특징**: 메모리 기반, 단일 함수 컨텍스트 내에서 즉시 실행
- **정책**: ❌ 비즈니스 로직, ❌ 부수 효과 없음

### 2. `events/listeners/` - 이벤트 구독자 (비동기 오케스트레이션)

**역할**: 비즈니스 로직 실행 (Event-Driven Subscribers)
**책임**: EventBus 이벤트 구독 및 업무 처리

```
events/listeners/
├── buttons/           (버튼 클릭 이벤트 처리)
│   ├── onAlertRegionEdit.ts
│   └── ...
└── commands/          (슬래시 명령 이벤트 처리)
    ├── onAlarmSubscribe.ts
    └── onRecruitRequest.ts
```

- **패턴**: `eventBus.on('recruit.changed', async (payload) => { ... })`
- **책임**: 한 가지 이벤트만 처리, 하나의 비즈니스 로직만 실행
- **정책**: ✅ 서비스 호출, ✅ 부수 효과 허용 / ❌ 다른 이벤트 emit 금지

### 3. `events/handlers/` - Discord 이벤트 라우팅 (진입점)

**역할**: Discord 상호작용 라우팅 및 변환
**책임**: Discord 이벤트 → EventBus 이벤트로 변환

```
events/handlers/
├── buttons/           (버튼 클릭 처리)
│   ├── alertModeSelectHandlers.ts
│   └── ...
├── commands/          (슬래시 명령 처리)
│   ├── alarmSubscribeHandlers.ts
│   └── ...
└── modals/            (모달 제출 처리)
```

- **패턴**: Discord 이벤트 받음 → 데이터 추출 → eventBus.emit()
- **책임**: 입력 검증, 데이터 추출, 이벤트 변환만 담당
- **정책**: ✅ 이벤트 발행 / ❌ 직접 서비스 호출, ❌ 비즈니스 로직 금지

### 아키텍처 데이터 흐름

```
Discord Event (사용자 상호작용)
    ↓
events/handlers/  ← Route & Transform
    ↓
eventBus.emit()   ← events/bus/ (Event 발행)
    ↓
events/listeners/ ← Subscribe & Execute (서비스 호출)
    ↓
Discord API/DB (상태 변경)
```

**구체적 예시**:
```typescript
// 1️⃣ 사용자가 버튼 클릭
// 2️⃣ events/handlers/buttons/onAlertRegionEdit.ts
const onAlertRegionEdit = async (interaction) => {
  const { userId, regionId } = extractData(interaction);
  // 단순 변환: Discord 이벤트 → EventBus 이벤트
  eventBus.emit('subscription.regionUpdated', { userId, regionId });
};

// 3️⃣ events/listeners/subscriptions/onRegionUpdated.ts
eventBus.on('subscription.regionUpdated', async ({ userId, regionId }) => {
  // 비즈니스 로직 실행
  await subscriptionService.updateRegion(userId, regionId);
  // 결과를 Discord에 보냄
});
```

### 경로 별칭 정의 (통합 진입점)

```json
"@/events/bus": ["src/events/bus"],
"@/events/bus/*": ["src/events/bus/*"]
```

```typescript
// events/index.ts - 중앙화된 export 관리
export { eventBus, EventBus } from "./bus/EventBus";
export * from "./bus/types";
export * from "./bus/constants";
export { registerAllEventHandlers } from "./bus/utils/registerEventHandlers";
```

- 모든 EventBus 관련 export를 한 곳에서 관리
- 사용자는 `@/events`에서만 import하면 됨

---

## 🔔 주의 사항

### 1️⃣ 의존성 검토 필요
**중요**: Phase 1.3과의 의존성 관계
- Phase 1.12 (아키텍처)을 먼저 완료
- Phase 1.3 (RecruitCacheService 이벤트)이 이를 의존
- 병합 순서: Phase 1.12 → Phase 1.3 (Merge 충돌 위험)

### 2️⃣ 구조적 책임 분리 확인

**각 폴더의 책임이 명확한지 검증 필수**:

```typescript
// ✅ GOOD: events/handlers/ 는 이벤트 변환만
events/handlers/buttons/onAlertRegionEdit.ts:
  const { userId, regionId } = extractData(interaction);
  eventBus.emit('subscription.regionUpdated', { userId, regionId });

// ❌ BAD: 직접 서비스 호출 (handlers는 변환만 해야 함)
events/handlers/buttons/onAlertRegionEdit.ts:
  await subscriptionService.updateRegion(userId, regionId);  // 금지!

// ✅ GOOD: events/listeners/ 는 비즈니스 로직 실행
events/listeners/onRegionUpdated.ts:
  eventBus.on('subscription.regionUpdated', async (payload) => {
    await subscriptionService.updateRegion(...);  // 비즈니스 로직
  });

// ❌ BAD: listeners에서 다른 이벤트 발행 (비즈니스 로직 처리 후 emit만 가능)
events/listeners/onRegionUpdated.ts:
  eventBus.emit('subscription.updated', ...);     // 금지!

// ✅ GOOD: events/bus/ 는 순수 이벤트 인프라
events/bus/EventBus.ts:
  emitEvent<T>(event: T, payload: EventPayloadMap[T]): boolean { ... }
  onEvent<T>(event: T, handler: EventHandler<T>): this { ... }

// ❌ BAD: bus에 비즈니스 로직 추가 (금지)
events/bus/EventBus.ts:
  await subscriptionService.updateRegion(...);  // 금지!
```

**검증 명령**:
```bash
# handlers/에서 서비스 호출 확인
grep -r "Service\." functions/src/events/handlers/ --include="*.ts"

# listeners/에서 eventBus.emit 사용 확인
grep -r "eventBus\.emit" functions/src/events/listeners/ --include="*.ts"

# 모든 @/events/bus import 경로 확인
grep -r "@/events/bus" functions/src/ --include="*.ts"
```

### 3️⃣ 다른 브랜치와의 병합 전략
- Phase 1.12가 먼저 merge되어야 Phase 1.3 merge 가능
- 폴더 이름 변경(`eventBus/` → `bus/`)으로 인한 Merge 충돌 가능
- 권장: rebase 전략 사용 (three-way merge보다 안전)

---

## 📝 피드백 반영 내역

### [Revision 1] 2026-01-27

**피드백**:
- 아키텍처 개선: 3-폴더 구조를 책임 중심으로 재설계 (bus, listeners, handlers)
- import alias 정리: `@/events/*` 만 유지

**수정 사항**:
- 구현 하이라이트 재구성 (기술 중심 → 책임 중심)
  - 각 폴더의 역할과 책임을 명확히 정의
  - 아키텍처 데이터 흐름 다이어그램 추가
  - Good/Bad 코드 패턴 예시 추가
- 주의 사항 강화
  - 구조적 책임 분리 검증 항목 추가 (Good/Bad 패턴 제시)
  - 검증 명령 추가 (grep으로 violations 확인)
- tsconfig.json 정리
  - `@/events/eventBus` alias 제거 (line 26-27)
  - `@/events/*` 만 유지 (충분함)
- 폴더 이름 변경
  - `functions/src/events/eventBus/` → `functions/src/events/bus/`
- 모든 import 경로 업데이트
  - `eventBus` → `bus` 변경
- 영향받은 파일:
  - `functions/tsconfig.json` (이미 수정됨)
  - `functions/src/events/index.ts`
  - 모든 listeners/ 파일
  - 모든 handlers/ 파일
  - 다른 eventBus import 파일들

**재테스트 결과**: ✅ Pass
- handlers/ 검증: 직접 서비스 호출 없음 ✓
- listeners/ 검증: eventBus.emit 없음 ✓
- 책임 분리 정책 준수 확인됨 ✓

---

### [Revision 2] 2026-01-27

**추가 개선**:
- EventHandler 인터페이스 네이밍 충돌 해결
- Events 레이어 기초 정리

**수정 사항**:
- EventHandler 인터페이스 구분
  - `bus/types.ts`: EventBus 구독자용 타입 `EventHandler<T>` (유지)
  - `discordEventHandler.ts`: Discord.js 이벤트 핸들러용 인터페이스 `DiscordEventHandler` (이름 변경)
- 파일명 변경
  - `events/eventHandler.ts` → `events/discordEventHandler.ts`
  - Discord 이벤트 핸들러의 명시적 도메인 구분
- Import 경로 업데이트 (4개 파일)
  - `onReady.ts`: `EventHandler` → `DiscordEventHandler` 적용
  - `onInteraction.ts`: `EventHandler` → `DiscordEventHandler` 적용
  - `onPingPongCreate.ts`: `EventHandler` → `DiscordEventHandler` 적용
- fullActionId.ts 이동
  - `events/fullActionId.ts` → `features/alarmSubscribe/constants/fullActionId.ts`
  - Feature 기반 구조 강화 (기능별 상수 분리)
- Import 경로 업데이트 (7개 파일)
  - `features/alarmSubscribe/types/alarmSubscribeCommand.ts`
  - `events/handlers/buttons/alertModeSelectHandlers.ts`
  - `common/utils/isValidFullActionId.ts`
  - `events/handlers/buttons/regionModeChangeConfirmHandlers.ts`
  - `events/handlers/buttons/showSubscribeOptionHandler.ts`
  - `events/listeners/buttons/onAlertRegionEdit.ts`
  - `events/handlers/buttons/alertRegionEditHandlers.ts`

**검증 결과**: ✅ Pass
- EventHandler 네이밍 충돌 해결 ✓
- fullActionId import 경로 모두 업데이트됨 ✓
- 레이어 책임 분리 강화됨 ✓
- TypeScript 컴파일 (기존 에러 제외) 성공 ✓

---

## 📋 다음 단계

**참고 문서**: [PROJECT_CONTEXT.md - Git Workflow](../../PROJECT_CONTEXT.md#-git-workflow)

1. [x] 사용자 피드백 확인 및 승인 ✅
2. [x] 구조적 책임 분리 검증 (위의 검증 명령 실행) ✅
   - [x] handlers/에서 직접 서비스 호출 여부 확인 ✓ 없음
   - [x] listeners/에서 다른 이벤트 발행 여부 확인 ✓ 없음
   - [x] bus/ 폴더에 비즈니스 로직이 없는지 확인 ✓ 확인됨
3. [x] 필요 시 import 경로 추가 업데이트 (`@/events/eventBus` → `@/events/bus`) ✅
4. [x] Git 커밋 및 PR 생성 (dev 브랜치 base) ✅
5. [x] Phase 1.3과의 병합 순서 확인 ✅
6. [x] PROGRESS.md 업데이트 ✅
7. [x] Phase 1.3 검토 진행 ✅

---

*작성일: 2026-01-16*
*개선일: 2026-01-27*
*검토자: Claude (AI Assistant)*

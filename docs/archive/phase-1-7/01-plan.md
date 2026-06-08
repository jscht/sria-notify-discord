# Phase 1.7: 자동 알림 시스템 (auto-notification-system)

**상태**: 🔄 진행 중
**우선순위**: P0
**의존성**: phase-1-3-recruitcacheservice-event-integration (✅ completed), phase-1-4-notification-store (✅ archived)

---

## 개요

### 배경
크롤링이 새 공고를 감지하면 `RECRUIT_NEW` 이벤트가 발행된다(Phase 1.3 완료). 구독자별 알림 설정 저장소도 구축됐다(Phase 1.4 완료). 그러나 둘을 잇는 **소비 계층이 없어**, 새 공고가 감지돼도 구독자에게 알림이 가지 않는다. Phase 1.7은 이 공백을 메우는 핵심 기능이다.

### 목표
`RECRUIT_NEW` 이벤트를 구독하여, 활성 구독자를 조회하고, 각 구독자의 알림 모드(전체/선택)와 지역으로 공고를 필터링한 뒤, 구독자별 `NOTIFICATION_SEND` 이벤트를 발행한다.

### 범위

| 포함 | 제외 |
|------|------|
| `RECRUIT_NEW` 구독 → 활성 구독자 조회 → 모드/지역 필터 → `NOTIFICATION_SEND` 발행 | 실제 DM 발송 (Phase 1.8 영역) |
| `RecruitFilter` (모드/지역 필터 순수 함수) | `registerAllEventHandlers()` startup 호출 wiring (Phase 1.9 영역) |
| `registerEventHandlers.ts` 알림 핸들러 등록 활성화 | Phase 1.3 try-catch → errorHandler 에러 고도화 (소비자 부재 — Phase 2.1과 재검토) |

> **설계 경계 = 이벤트 경계.** Phase 1.7은 구독자별 필터링 후 `NOTIFICATION_SEND` 이벤트 발행까지만 담당한다. 실제 DM 전송은 Phase 1.8 핸들러가 수행하므로, **1.7 단독으로는 DM이 실제 전송되지 않는다**(의도된 설계).

---

## 요구사항

### 기능 요구사항
1. `EventBus`에서 `EventType.RECRUIT_NEW`(`"recruit:new"`)를 구독한다. 페이로드 `RecruitNewEvent`는 flat 구조(`{ timestamp, source?, addedJobs, updatedJobs, deletedIds }`)다.
2. `SubscriptionStore.getAllActiveSubscribers()`로 `enabled === true` 구독자(`AlarmSubscription[]`)를 조회한다.
3. 각 구독자에 대해 알림 모드별 필터링한다:
   - `AlertMode.ALL` → 새 공고 전체 대상
   - `AlertMode.SELECTED` → 구독자 `regions: CityEn[]`에 매칭되는 공고만 (`CityEn` → `toKorean` 변환 후 `value.title.includes(koreanName)`, 기존 `filterListByCity` 코어 재사용)
4. 매칭 공고가 1개 이상인 구독자에 대해 `emitEvent<NotificationSendEvent>(NOTIFICATION_SEND, { userId, jobs, settings })`를 발행한다.
5. `registerEventHandlers.ts`에서 알림 핸들러 등록 placeholder를 활성화한다. (`registerAllEventHandlers()` 실제 호출은 Phase 1.9에 위임)

### 비기능 요구사항
- **성능**: 구독자 수 × 공고 수 선형 필터링. 구독자별 발행은 동기 루프(소량 가정), 대량화는 후속 Phase에서 검토.
- **호환성**: 기존 `RECRUIT_NEW` 발행부(recruitCacheService) 변경 없음. `NOTIFICATION_SEND` 타입은 기정의된 것 재사용.
- **에러 처리**: 핸들러 내부는 try-catch로 감싸 emitter로 재throw 금지(EventBus 안정성). 알림 잡셋 기본값은 `addedJobs`(신규 공고). `updatedJobs` 포함 여부는 design 단계에서 확정(스팸 방지 위해 기본 제외 권장).

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식
이벤트 구동 소비자 패턴. `NotificationEventHandler`가 `RECRUIT_NEW`를 구독 → `notificationService.notifyNewRecruits(payload)` 호출 → 서비스가 구독자 조회·필터·발행을 오케스트레이션. 필터 로직은 순수 함수(`RecruitFilter`)로 분리해 테스트 가능성과 DRY 확보(`filterListByCity` 재사용).

흐름:
```
RECRUIT_NEW 수신
  → getAllActiveSubscribers()
  → 각 구독자:
       ALL      → 전체 addedJobs
       SELECTED → filterByRegion(addedJobs, regions)
  → 매칭 잡 ≥ 1 → emitEvent<NotificationSendEvent>(NOTIFICATION_SEND, { userId, jobs, settings })
```

### 영향 받는 파일 (do 단계 산출물 예정)
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `functions/src/services/notificationService.ts` | 신규 | `notifyNewRecruits(payload: RecruitNewEvent)`: 구독자 조회 → 필터 → 구독자별 `NOTIFICATION_SEND` 발행. 핸들러 try-catch로 재throw 금지 |
| `functions/src/features/notification/filters/RecruitFilter.ts` | 신규 | `filterByMode(jobs, mode)`, `filterByRegion(jobs: Job[], regions: CityEn[])` — `filterListByCity` 코어 재사용, `toKorean` 변환 후 `value.title.includes()` |
| `functions/src/events/bus/handlers/NotificationEventHandler.ts` | 신규 | `registerNotificationHandlers()`: `eventBus.onEvent<RecruitNewEvent>(RECRUIT_NEW, ...)` |
| `functions/src/events/bus/utils/registerEventHandlers.ts` | 수정 | `registerNotificationHandlers()` 호출 주석 해제(등록만, startup 호출은 1.9) |

### 위임 계획 (CTO Lead 게이트 결과)
| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|------------|
| 서비스 오케스트레이션 + 이벤트 핸들러 등록 | **Integration Lead** | RECRUIT_NEW → 구독자 조회 → NOTIFICATION_SEND 의 서비스 간 연동·이벤트 흐름 조율이 핵심 | `notificationService.ts`, `NotificationEventHandler.ts`, `registerEventHandlers.ts` 수정 |
| 필터 순수 로직 | **Backend Expert** (Integration Lead 위임) | 모드/지역 필터는 데이터 변환 순수 함수 — `filterListByCity` 재사용 + `CityEn→한글` 매칭 | `RecruitFilter.ts` |

> Discord UI 없음(이벤트 경계까지만) → Discord Agent 미관여. 실제 DM 발송 핸들러는 Phase 1.8.

### 의존성 분석
- **선행(충족)**: Phase 1.3(`RECRUIT_NEW` 발행), Phase 1.4(`SubscriptionStore`, `AlarmSubscription` 타입).
- **후속**: Phase 1.8(`NOTIFICATION_SEND` 소비 → 실제 DM 발송), Phase 1.9(`registerAllEventHandlers()` startup wiring → E2E 활성화).

---

## 성공 기준

- [ ] `docs/phase-1-7/01-plan.md` 템플릿 구조 준수 + 결정사항(이벤트 경계·제외 항목·1.8/1.9 위임) 반영
- [ ] feature 브랜치 `feature/phase-1.7-auto-notification-system` 생성
- [ ] pdca-memory.json / pdca-status.json 갱신 (phase="plan")
- [ ] TypeScript 컴파일 성공 (do 단계 검증)
- [ ] 기존 `RECRUIT_NEW` 발행부 정상 동작 확인 (do 단계 검증)

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| `RecruitData`에 구조화된 region 필드 없음 — 지역이 `title` 한글 부분문자열뿐 → 오탐/누락 가능 | 중 | 기존 `filterListByCity` 동일 정책 유지, design에서 엣지케이스(복수 지역·동음 지명) 검토 |
| 1.7 단독 런타임 검증 불가 (1.8 DM sender, 1.9 startup wiring 미완) | 중 | 정적 검증(타입·핸들러 등록) 위주, E2E는 1.9 통합 시점으로 명시(알려진 갭) |
| CLAUDE.md 예시 stale (`payload.data.*`, `getDiscordClient`, `NOTIFICATION_FAILED`) | 저 | 코드 SoT(`events/bus/types.ts`) 기준으로만 구현 |

---

*작성일: 2026-06-08*
*시드: .claude/phases/phase-1-core.md*

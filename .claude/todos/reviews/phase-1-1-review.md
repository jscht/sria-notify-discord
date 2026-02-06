# Phase 1.1: EventBus 인프라 구축 ✅

**상태**: 완료 (2026-01-11)
**우선순위**: ⭐⭐⭐ 최우선
**의존성**: 없음

---

## 📊 개선 작업 현황

### Logging System 개선 ✅
- SystemLogger 구현 완료
- 구조화된 JSON 로깅
- 성능 측정 기능 (startTimer)
- Child Logger 지원
- **보고서**: [logging-system-improvement-report.md](./logging-system-improvement-report.md)
- **가이드**: [SYSTEM_LOGGER_GUIDE.md](../../../functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)

### Error System 개선 ✅
- SystemError 클래스 구현 (ErrorLevel: WARNING, FAILURE, CRITICAL)
- 10가지 ErrorCategory
- 11개 팩토리 메서드
- 에러 처리 유틸리티 (withErrorHandler, withRetry, allSettledWithErrors, errorBoundary)
- EventBus 자동 통합
- **보고서**: [error-system-improvement-report.md](./error-system-improvement-report.md)
- **가이드**: [SYSTEM_ERROR_GUIDE.md](../../../functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)

### EventBus 타입 정의 개선 ✅
- System Error 이벤트 타입 추가:
  - `SYSTEM_ERROR_CRITICAL`
  - `SYSTEM_ERROR_FAILURE` (ERROR → FAILURE로 명명 변경)
  - `SYSTEM_ERROR_WARNING`
- ErrorLevel과 EventType 완전 매핑

---

## 📝 작업 체크리스트

### 1. EventBus.ts 생성
- [🔄] Singleton 패턴 구현
- [🔄] `emitEvent<T>()` 타입 안전 메서드
- [🔄] `onEvent<T>()` 타입 안전 메서드
- [🔄] `setMaxListeners(100)` 설정
- [🔄] 추가 메서드: `onceEvent`, `offEvent`, `removeAllListenersForEvent`, `listenerCountForEvent`

### 2. types.ts 이벤트 타입 정의
- [🔄] `EventType` enum 정의 (recruit, notification, error, admin, proxy)
- [🔄] `BaseEvent` 인터페이스
- [🔄] Recruit Domain 이벤트: `RecruitCrawlStartedEvent`, `RecruitCrawlCompletedEvent`, `RecruitCrawlFailedEvent`, `RecruitNewEvent`, `RecruitRequestedEvent`
- [🔄] Notification Domain 이벤트: `NotificationSubscribeEvent`, `NotificationUnsubscribeEvent`, `NotificationSendEvent`, `NotificationSentEvent`
- [🔄] Error Domain 이벤트: `ErrorEvent`
- [🔄] Admin Domain 이벤트: `AdminBroadcastRequestEvent`, `AdminBroadcastSentEvent`
- [🔄] 타입 매핑: `EventPayloadMap`, `EventHandler`, `EventName`
- [🔄] 관련 타입 import: `Job`, `JobDiffResult`, `CityEn`, `AlertMode`, `AlarmSubscription`

### 3. constants.ts 이벤트 상수 정의
- [🔄] `EVENT_BUS_CONFIG`: MAX_LISTENERS, EVENT_TIMEOUT_MS
- [🔄] `EVENT_DOMAIN`: recruit, notification, error, admin, proxy
- [🔄] `EVENT_ACTION`: 각 도메인별 액션 상수
- [🔄] `LOG_COLORS`: 로그 색상 코드

### 4. registerEventHandlers.ts 핸들러 등록 유틸
- [🔄] `registerAllEventHandlers()` 함수 구현
- [🔄] Cold Start 시 재등록 방지 로직 (`handlersRegistered` 플래그)
- [🔄] `areHandlersRegistered()` 헬퍼 함수
- [🔄] `resetHandlerRegistration()` 테스트용 함수
- [🔄] Phase별 핸들러 등록 준비 (주석 처리)

### 5. index.ts 모듈 export
- [🔄] EventBus, eventBus export
- [🔄] types 전체 export
- [🔄] constants 전체 export
- [🔄] utils 함수 export

### 6. 테스트 작성
- [🔄] `__test__/EventBus.test.ts` 작성
- [🔄] Singleton 인스턴스 테스트
- [🔄] 이벤트 리스너 등록 테스트
- [🔄] 이벤트 발행 테스트
- [🔄] 이벤트 수신 확인 테스트
- [🔄] 리스너 수 확인 테스트
- [🔄] 테스트 실행 성공 확인 ✅

---

## ✅ 완료 기준

- [🔄] EventBus.getInstance()로 전역 인스턴스 접근 가능
- [🔄] emitEvent/onEvent 메서드 정상 동작
- [🔄] 타입 추론이 올바르게 작동

---

## 📂 생성된 파일 목록

```
functions/src/eventBus/
├── EventBus.ts                       # 160 lines
├── types.ts                          # 197 lines
├── constants.ts                      # 80 lines
├── index.ts                          # 20 lines
├── claude.md                         # 문서 (기존)
├── utils/
│   └── registerEventHandlers.ts     # 80 lines
└── __test__/
    └── EventBus.test.ts             # 90 lines
```

**총 코드 라인**: ~627 lines

---

## 🔍 검토 사항

**참고 문서**: [REVIEW_PROCESS.md](./REVIEW_PROCESS.md)

### 코드 리뷰
- [x] EventBus.ts의 Singleton 패턴 구현 확인 ✅
  - private static instance, private constructor, getInstance() 확인
- [x] types.ts의 타입 정의 완전성 확인 ✅
  - [x] System Error 이벤트 타입 3개 (CRITICAL, FAILURE, WARNING) 확인 ✅
  - [x] EventPayloadMap에 SystemErrorEvent 매핑 확인 ✅
- [x] constants.ts의 상수 네이밍 일관성 확인 ✅
  - EVENT_DOMAIN.SYSTEM_ERROR, EVENT_ACTION.CRITICAL/WARNING 확인
- [x] registerEventHandlers.ts의 재등록 방지 로직 확인 ✅
  - handlersRegistered 플래그, areHandlersRegistered(), resetHandlerRegistration() 확인

### 기능 테스트
- [x] EventBus 테스트 결과 확인 ✅
  - 모든 테스트 통과 (Singleton, 리스너 등록, 이벤트 발행/수신, 타입 안전성)
- [x] 타입 추론이 IDE에서 올바르게 작동하는지 확인 ✅
  - TypeScript 컴파일 시 타입 체크 완료
- [x] import 경로가 올바른지 확인 ✅
  - index.ts를 통한 깔끔한 export 구조 확인
- [x] SystemError 생성 시 EventBus 자동 발행 확인 ✅
  - errorHandler.ts:38, 49에서 emitSystemErrorEvent() 호출 확인
  - SystemError 발생 시 자동 발행, 500번대 에러도 SystemError 변환 후 발행
- [x] ErrorLevel → EventType 매핑 확인 ✅
  - errorHandler.ts:87-103에서 switch문으로 완전 매핑 확인
  - CRITICAL → SYSTEM_ERROR_CRITICAL
  - FAILURE → SYSTEM_ERROR_FAILURE
  - WARNING → SYSTEM_ERROR_WARNING

### Logging System 검토
- [x] SystemLogger 클래스 동작 확인 ✅
  - [x] debug, info, warn, error, success 메서드 (systemLogger.ts:166-207)
  - [x] startTimer 성능 측정 (systemLogger.ts:212-219)
  - [x] child Logger 생성 (systemLogger.ts:224-226)
- [x] DebugLogger 하위 호환성 확인 ✅
  - Logger 클래스가 내부적으로 SystemLogger 사용 (logger.ts:15-50)
  - 40개 파일 그대로 동작 가능
- [x] globalLogger 전역 접근 확인 ✅
  - global.globalLogger, global.createGlobalLogger 등록 (systemLogger.ts:244-247)

### Error System 검토
- [x] SystemError 클래스 동작 확인 ✅
  - [x] 자동 로깅 확인 (systemError.ts:138)
  - [x] toJSON() 직렬화 (systemError.ts:329-347)
  - [x] originalError 체이닝 (systemError.ts:133-135)
- [x] 팩토리 메서드 12개 확인 ✅
  - crawlerFailed, databaseError, externalApiError, discordApiError, eventBusError, proxyError, authError, validationError, timeoutError, critical, warning, wrap
- [x] 에러 처리 유틸리티 확인 ✅
  - [x] withErrorHandler (errorHandler.ts)
  - [x] withRetry (errorHandler.ts)
  - [x] allSettledWithErrors (errorHandler.ts)
  - [x] errorBoundary (errorHandler.ts)
- [x] HttpError vs SystemError 구분 확인 ✅
  - HttpError: HTTP 응답 전용 (errors.ts)
  - SystemError: 시스템 내부 에러 (systemError.ts)

### 문서화
- [x] 각 파일의 JSDoc 주석 확인 ✅
  - EventBus.ts, types.ts, systemLogger.ts, systemError.ts 모두 상세한 JSDoc 포함
- [x] 개선 보고서 2개 확인 ✅
  - [x] [logging-system-improvement-report.md](./logging-system-improvement-report.md) (211줄)
  - [x] [error-system-improvement-report.md](./error-system-improvement-report.md) (306줄)
- [x] 사용 가이드 2개 확인 ✅
  - [x] [SYSTEM_LOGGER_GUIDE.md](../../../functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)
  - [x] [SYSTEM_ERROR_GUIDE.md](../../../functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)

---

## 💡 구현 하이라이트

### 1. 타입 안전성
- EventType enum과 EventPayloadMap을 통한 완전한 타입 추론
- Generic을 활용한 emitEvent/onEvent 메서드

### 2. Cold Start 대응
- Firebase Functions 환경을 고려한 재등록 방지 로직
- 모듈 레벨에서 1회만 실행되는 핸들러 등록

### 3. 확장성
- Phase별로 핸들러를 추가할 수 있는 구조
- 도메인별로 분리된 이벤트 타입 설계

### 4. 개발자 경험
- 깔끔한 import 구조 (index.ts)
- 상세한 JSDoc 주석과 사용 예시
- 테스트 코드를 통한 사용법 제시

---

## 📋 다음 단계

**참고 문서**: [PROJECT_CONTEXT.md - Git Workflow](../../PROJECT_CONTEXT.md#-git-workflow)

1. [x] 사용자 피드백 확인 및 승인 ✅
2. [x] Git 커밋 및 PR 생성 (dev 브랜치) ✅
3. [x] PROGRESS.md, phase-X-**.md, phase-X-Y-review.md의 Phase X.Y 진행률 업데이트 ✅
4. [x] 다음 Phase 시작 ✅

---

*작성일: 2026-01-07*
*검토자: 사용자*

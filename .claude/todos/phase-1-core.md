# Phase 1: 핵심 기능 구현

> 이벤트 기반 아키텍처 전환 및 핵심 기능 구현

**현재 진행률**: 27.3% (3/11 완료)

---

## 📊 Sub-Phase 진행 상황

| Sub-Phase | 작업명 | 완료 | 진행 중 | 대기 중 |
|-----------|--------|------|---------|---------|
| Phase 1.1 | EventBus 인프라 | 5 | 0 | 0 |
| Phase 1.2 | 스케줄러 이벤트 | 0 | 0 | 3 |
| Phase 1.3 | RecruitCacheService | 2 | 0 | 0 |
| Phase 1.4 | 알림 설정 저장소 | 0 | 0 | 4 |
| Phase 1.5 | 알림 설정 UI | 0 | 0 | 5 |
| Phase 1.6 | 공고 요청 개선 | 0 | 0 | 2 |
| Phase 1.7 | 자동 알림 시스템 | 0 | 0 | 4 |
| Phase 1.8 | DM 발송 유틸리티 | 0 | 0 | 3 |
| Phase 1.9 | 스케줄러 재활성화 | 0 | 0 | 4 |
| Phase 1.10 | Proxy 통합 및 우회 설정 | 0 | 0 | 5 |
| Phase 1.11 | DebugLogger 마이그레이션 | 0 | 0 | 4 |
| Phase 1.12 | Events 아키텍처 통합 | 5 | 0 | 0 |

---

## Phase 1.1: EventBus 인프라 구축 ✅ (완료)
**우선순위**: ⭐⭐⭐ 최우선
**의존성**: 없음
**완료일**: 2026-01-11

- [x] `src/eventBus/EventBus.ts` 생성
  - [x] Singleton 패턴 구현
  - [x] `emitEvent<T>()` 타입 안전 메서드
  - [x] `onEvent<T>()` 타입 안전 메서드
  - [x] `setMaxListeners(100)` 설정

- [x] `src/eventBus/types.ts` 이벤트 타입 정의
  - [x] `EventType` enum 정의 (recruit, notification, error, admin)
  - [x] `BaseEvent` 인터페이스
  - [x] `RecruitNewEvent`, `NotificationSendEvent` 등 구체 타입
  - [x] `Job`, `AlarmSubscription` 등 관련 타입 import

- [x] `src/eventBus/constants.ts` 이벤트 상수 정의

- [x] `src/eventBus/utils/registerEventHandlers.ts` 핸들러 등록 유틸
  - [x] 모든 이벤트 핸들러 자동 등록 함수
  - [x] Cold Start 시 재등록 방지 로직

- [x] 테스트 작성 및 통과

**완료 기준**:
- [x] EventBus.getInstance()로 전역 인스턴스 접근 가능
- [x] emitEvent/onEvent 메서드 정상 동작
- [x] 타입 추론이 올바르게 작동

**검토 문서**: [phase-1-1-review.md](./reviews/phase-1-1-review.md)

---

## Phase 1.2: 스케줄러 이벤트 발행 전환 (1-2시간)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.1 완료

- [ ] `crawlers/schedulers/base/BaseScheduler.ts` 수정
  - [ ] EventBus import
  - [ ] `performWork()` 시작 시 `recruit.crawl.started` 발행
  - [ ] `performWork()` 성공 시 `recruit.crawl.completed` 발행
  - [ ] `performWork()` 실패 시 `recruit.crawl.failed` 발행

- [ ] `crawlers/schedulers/RecruitScheduler.ts` 검토
  - [ ] BaseScheduler의 이벤트 발행이 정상 작동하는지 확인

- [ ] 테스트
  - [ ] 스케줄러 수동 실행 시 이벤트 발행 확인
  - [ ] 로그에 이벤트 발행 기록 확인

**완료 기준**:
- [ ] 스케줄러 실행 시 crawl.started/completed 이벤트 발행
- [ ] 에러 발생 시 crawl.failed 이벤트 발행

---

## Phase 1.3: RecruitCacheService 이벤트 통합 ✅ (완료)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.1 완료
**완료일**: 2026-01-31

- [x] `services/recruitCacheService.ts` 수정
  - [x] EventBus import
  - [x] `setRecruitList()` CHANGED 상태일 때 `recruit.new` 이벤트 발행
  - [x] 이벤트 페이로드: `{ addedJobs, updatedJobs, deletedIds }`
  - [x] 이벤트 발행 실패 시 try-catch 처리 (비즈니스 로직 보호)

- [x] 테스트
  - [x] 새 공고 추가 시 recruit.new 이벤트 발행 확인
  - [x] addedJobs, updatedJobs, deletedIds 올바른지 확인

**완료 기준**:
- [x] diffJobs() 결과가 이벤트로 발행됨
- [x] 변경사항 없을 때는 이벤트 발행 안 함

**검토 문서**: [phase-1-3-review.md](./reviews/phase-1-3-review.md)

---

## Phase 1.4: 알림 설정 저장소 구현 (2-3시간)
**우선순위**: ⭐⭐⭐
**의존성**: Firebase Admin SDK 설정 완료

- [ ] Firestore 스키마 설계
  - [ ] `users/{userId}/notifications/settings` 구조 정의
  - [ ] firestore.indexes.json에 인덱스 추가 (필요시)

- [ ] `providers/firebase/store/subscription.ts` 구현
  - [ ] `getNotificationSettings(userId)` 함수
  - [ ] `setNotificationSettings(userId, settings)` 함수
  - [ ] `updateAlertMode(userId, mode)` 함수
  - [ ] `updateAlertRegions(userId, regions)` 함수
  - [ ] `toggleNotificationEnabled(userId, enabled)` 함수
  - [ ] `getAllActiveSubscribers()` 함수 (enabled: true 필터링)

- [ ] 기본값 설정 로직
  - [ ] 신규 사용자 자동 생성 (enabled: false, alertMode: 'ALL', regions: [])

- [ ] 테스트
  - [ ] Firestore 저장/조회 수동 확인

**완료 기준**:
- [ ] Firestore에 사용자 알림 설정 저장 가능
- [ ] getAllActiveSubscribers()가 활성 구독자 반환

---

## Phase 1.5: 알림 설정 UI 완성 (2-3시간)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.4 완료

- [ ] `features/alarmSubscribe/services/notificationSettingsService.ts` 작성
  - [ ] `getUserAlertMode(userId)` 구현
  - [ ] `setUserAlertMode(userId, mode)` 구현
  - [ ] `getUserAlertRegions(userId)` 구현
  - [ ] `addUserAlertRegion(userId, region)` 구현
  - [ ] `removeUserAlertRegion(userId, region)` 구현

- [ ] 헬퍼 함수 구현
  - [ ] `regionModeChangeButtons()` - 지역 선택 버튼 생성
  - [ ] `formatRegionList(regions)` - 지역 목록 포맷팅

- [ ] 미구현 버튼 핸들러 완성
  - [ ] `onEnableSelectedRegionAlert` 구현
  - [ ] `onAddOrRemoveAlertRegion` 구현
  - [ ] `onConfirmAlertModeChange` 구현

- [ ] 모달 제출 핸들러 완성
  - [ ] 지역 추가/제거 모달 처리

- [ ] 이벤트 발행 추가
  - [ ] 설정 변경 시 `notification.subscribe` 이벤트
  - [ ] 구독 해제 시 `notification.unsubscribe` 이벤트

**완료 기준**:
- [ ] `/alarm-subscribe` 명령어 전체 플로우 동작
- [ ] Firestore에 설정 저장 확인

---

## Phase 1.6: 공고 요청 기능 개선 (1시간)
**우선순위**: ⭐⭐
**의존성**: Phase 1.1 완료

- [ ] `features/recruitRequest` 기존 기능 리뷰
  - [ ] 현재 동작 방식 확인

- [ ] `services/recruitService.ts` 수정 (선택)
  - [ ] 공고 조회 시작 시 `recruit.requested` 이벤트 발행
  - [ ] 공고 조회 완료 시 `recruit.request.completed` 이벤트 발행

**완료 기준**:
- [ ] `/recruit-request` 명령어 정상 동작

---

## Phase 1.7: 자동 알림 시스템 구현 (3-4시간)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.3, 1.4 완료

- [ ] `services/notificationService.ts` 생성
  - [ ] EventBus에서 `recruit.new` 이벤트 리스너 등록
  - [ ] `notifyNewRecruits(recruits)` 메서드 구현
    - [ ] `getAllActiveSubscribers()` 호출
    - [ ] 지역 필터링 (alertMode: 'SELECTED'인 경우)
    - [ ] 사용자별로 Discord DM 발송

- [ ] `features/notification/filters/RecruitFilter.ts` 생성
  - [ ] `filterByRegion(recruits, regions)` 함수
  - [ ] `filterByMode(recruits, mode)` 함수

- [ ] `eventBus/utils/registerEventHandlers.ts` 수정
  - [ ] NotificationService 등록

- [ ] **Phase 1.3 마이그레이션: 이벤트 발행 실패 처리 고도화** (선택)
  - [ ] `services/recruitCacheService.ts` try-catch 제거
  - [ ] `withErrorHandler()` 또는 `errorBoundary()` 래퍼 적용
  - [ ] `emitSystemErrorEvent()` 호출로 SYSTEM_ERROR_FAILURE 이벤트 발행
  - [ ] 모니터링 시스템이 감지하여 대응 가능하도록 설계
  - **참고**: Phase 1.3에서 간단한 try-catch 구현, 이번 Phase에서 고도화

**완료 기준**:
- [ ] 크롤링 → 새 공고 감지 → 구독자 자동 알림 전체 플로우 동작

---

## Phase 1.8: Discord DM 발송 유틸리티 (2시간)
**우선순위**: ⭐⭐⭐
**의존성**: 없음 (Phase 1.7과 병렬 작업 가능)

- [ ] `providers/discord/utils/dmSender.ts` 작성
  - [ ] `sendNotificationDM(userId, options)` 함수
  - [ ] Rate Limit 대기 로직
  - [ ] 에러 처리 (사용자가 DM 차단한 경우 등)
  - [ ] 재시도 로직 (최대 3회)

- [ ] 발송 로그 기록
  - [ ] 성공/실패 로그
  - [ ] 발송 시각, 소요 시간

**완료 기준**:
- [ ] DM 발송 성공
- [ ] Rate Limit 자동 대기

---

## Phase 1.9: 스케줄러 재활성화 및 통합 (1시간)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.1-1.7 완료

- [ ] `common/middlewares/initializeWorker.ts` 수정
  - [ ] 스케줄러 초기화 주석 해제
  - [ ] Graceful shutdown 설정 주석 해제

- [ ] `app/index.ts` 수정
  - [ ] EventBus 핸들러 등록 (registerEventHandlers 호출)

- [ ] 스케줄러 설정 검토
  - [ ] RecruitScheduler 실행 주기 확인 (기본 4시간)
  - [ ] ProxyScheduler 실행 주기 확인 (기본 6시간)

- [ ] 테스트
  - [ ] 로컬 환경에서 스케줄러 정상 작동 확인
  - [ ] 크롤링 → 이벤트 발행 → 알림 발송 전체 플로우 통합 테스트

**완료 기준**:
- [ ] 스케줄러가 주기적으로 크롤링 실행
- [ ] 새 공고 발견 시 자동 알림 발송

---

## Phase 1.10: Proxy 통합 및 크롤러 우회 설정 (2-3시간)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.2, 1.8 완료

- [ ] ProxyScheduler 완성
  - [ ] `crawlers/schedulers/ProxyScheduler.ts` 수정
  - [ ] `saveProxyList()` 메서드 구현
  - [ ] ProxyStore와 연결하여 Firestore에 저장
  - [ ] 프록시 수집 실패 시 `error.critical` 이벤트 발행

- [ ] ProxyService 구현
  - [ ] `services/proxyService.ts` 생성
  - [ ] `getAvailableProxy()` - 사용 가능한 프록시 1개 반환
  - [ ] `markProxyAsUsed(ipAddress)` - 프록시 사용 중 표시
  - [ ] `markProxyAsFailed(ipAddress)` - 프록시 실패 처리
  - [ ] `releaseProxy(ipAddress)` - 프록시 사용 완료 처리
  - [ ] `hasAvailableProxy()` - 사용 가능한 프록시 존재 확인

- [ ] SriaCrawler 프록시 통합
  - [ ] `crawlers/strategies/recruit/SriaCrawler.ts` 수정
  - [ ] axios 설정에 프록시 적용 (https-proxy-agent 사용)
  - [ ] 크롤링 시작 전 `hasAvailableProxy()` 확인
  - [ ] 프록시 없으면 크롤링 중단 및 `proxy.unavailable` 이벤트 발행
  - [ ] 프록시 실패 시 다른 프록시로 재시도 (최대 3회)
  - [ ] 모든 프록시 실패 시 크롤링 중단 및 `proxy.unavailable` 이벤트 발행

- [ ] Proxy 에러 처리 핸들러
  - [ ] `features/proxyError/handlers/ProxyErrorHandler.ts` 생성
  - [ ] `proxy.unavailable` 이벤트 리스너 등록
  - [ ] 모든 활성 구독자에게 서비스 이용 제한 안내 DM 발송
  - [ ] 개발자에게 긴급 에러 알림 DM 발송

- [ ] DM 메시지 템플릿 작성
  - [ ] `features/proxyError/messages/templates.ts` 생성
  - [ ] 사용자용 메시지: "현재 서비스 이용에 일시적인 문제가 발생했습니다. 빠른 시일 내 복구하겠습니다."
  - [ ] 개발자용 메시지: "🚨 프록시 서버 전체 불가 - 크롤링 중단됨. 즉시 확인 필요"

**완료 기준**:
- [ ] ProxyScheduler가 6시간마다 프록시 목록 갱신 및 Firestore 저장
- [ ] SriaCrawler가 반드시 프록시를 통해서만 크롤링 수행
- [ ] 프록시 1개 실패 시 다른 프록시로 자동 전환 (최대 3회)
- [ ] 모든 프록시 사용 불가 시 사용자 및 개발자에게 알림 발송
- [ ] 프록시 없이는 크롤링 절대 수행 안 함 (실제 IP 보호)

---

## Phase 1.11: DebugLogger 마이그레이션 (2-3시간)
**우선순위**: ⭐⭐
**의존성**: Phase 1.1 완료 (SystemLogger 구축)

- [ ] 마이그레이션 계획 수립
  - [ ] DebugLogger 사용 파일 전체 목록 작성
  - [ ] 우선순위 및 의존성 분석
  - [ ] 마이그레이션 가이드라인 문서 작성

- [ ] 파일 마이그레이션 실행
  - [ ] `DebugLogger.server()` → `globalLogger.info()` 변환
  - [ ] `DebugLogger.request()` → `createGlobalLogger('request').info()` 변환
  - [ ] `DebugLogger.crawler()` → `createGlobalLogger('crawler').debug()` 변환
  - [ ] `DebugLogger.provider()` → `createGlobalLogger('provider:xxx').debug()` 변환
  - [ ] `DebugLogger.error()` → `globalLogger.error()` 변환
  - [ ] `DebugLogger.fail()` → `globalLogger.error()` 변환
  - [ ] `DebugLogger.warn()` → `globalLogger.warn()` 변환

- [ ] 레거시 코드 정리
  - [ ] `common/utils/logger.ts`에서 DebugLogger 전역 등록 제거
  - [ ] `common/types/global.d.ts`에서 DebugLogger 타입 선언 제거
  - [ ] Logger 클래스 deprecation 주석 추가

- [ ] 마이그레이션 검증
  - [ ] 모든 로그가 정상 출력되는지 확인
  - [ ] 로그 형식 및 컨텍스트가 올바른지 확인
  - [ ] 성능 영향 없는지 확인

**완료 기준**:
- [ ] 프로젝트 내 파일 모두 globalLogger/createGlobalLogger로 전환
- [ ] DebugLogger 전역 등록 제거
- [ ] 모든 로그 정상 작동

---

## Phase 1.12: Events 아키텍처 통합 및 레이어 정리 ✅ (완료)
**우선순위**: ⭐⭐⭐
**의존성**: Phase 1.1 완료 (EventBus 인프라)
**완료일**: 2026-01-27
**머지**: PR #7 → dev (2026-01-31)

**완료 항목 (5개)**: ✅ 모두 완료
- [x] Events 레이어 구조 정리 (bus, handlers, listeners 폴더 정리)
- [x] EventHandler 네이밍 충돌 해결 (EventHandler<T> vs DiscordEventHandler)
- [x] fullActionId.ts 이동 (events/ → features/alarmSubscribe/constants/)
- [x] Import 경로 11개 파일 업데이트
- [x] Git 커밋 및 PR 생성 (Commit: 4d4b8bd, PR #7)

**구체적 변경사항**:
1. **폴더 구조 정리**
   - `functions/src/events/eventBus/` → `functions/src/events/bus/`
   - 명칭 일관성 강화

2. **인터페이스 구분**
   - `bus/types.ts`: EventBus 구독자용 `EventHandler<T>` (유지)
   - `discordEventHandler.ts`: Discord.js용 `DiscordEventHandler` (이름 변경)
   - `events/eventHandler.ts` → `events/discordEventHandler.ts` (파일 이름 변경)

3. **기능별 구조 강화**
   - `fullActionId.ts` 이동: events/ → features/alarmSubscribe/constants/
   - Feature 기반 모듈화 개선

4. **Import 경로 업데이트** (11개 파일)
   - `functions/src/events/index.ts`
   - `functions/src/events/onReady.ts`
   - `functions/src/events/onInteraction.ts`
   - `functions/src/events/onPingPongCreate.ts`
   - `functions/src/events/handlers/buttons/alertModeSelectHandlers.ts`
   - `functions/src/events/handlers/buttons/alertRegionEditHandlers.ts`
   - `functions/src/events/handlers/buttons/regionModeChangeConfirmHandlers.ts`
   - `functions/src/events/handlers/buttons/showSubscribeOptionHandler.ts`
   - `functions/src/events/listeners/buttons/onAlertRegionEdit.ts`
   - `functions/src/features/alarmSubscribe/types/alarmSubscribeCommand.ts`
   - `functions/src/common/utils/isValidFullActionId.ts`

5. **파일 정리**
   - `functions/src/events/logHandler.ts` 제거 (미사용)

**검토 문서**: [phase-1-12-review.md](./reviews/phase-1-12-review.md)

**완료 기준**: ✅ 모두 완료
- [x] Events 레이어 구조 명확화 (bus, handlers, listeners)
- [x] 네이밍 충돌 제거 및 도메인 명시화
- [x] 기능별 상수 분리로 모듈화 강화
- [x] Import 경로 단순화 (@/events/* 만 필요)
- [x] 기술부채 감소 (불필요한 파일 정리)
- [x] TypeScript 컴파일 성공 (기존 에러 제외)

---

*최종 수정: 2026-01-31*
*상위 문서: [TODO.md](./TODO.md)*
*상태: Phase 1.1, 1.3, 1.12 완료 / Phase 1.2 진행 중 / Phase 1.4 대기*

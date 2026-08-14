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
| Phase 1.10 | Proxy 통합 + IP 우회 스크래핑 + 실 CRAWL + 프로덕션 배포·E2E | 0 | 0 | 11 |
| Phase 1.11 | DebugLogger 마이그레이션 | 0 | 0 | 4 |
| Phase 1.12 | Events 아키텍처 통합 | 5 | 0 | 0 |
| Phase 1.13 | 프로덕션 런타임 & 스케줄러 트리거 재설계 | 0 | 0 | 6 |

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

**검토 문서**: [phase-1-1-review.md](../docs/reviews/phase-1-1-review.md)

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

**검토 문서**: [phase-1-3-review.md](../docs/reviews/phase-1-3-review.md)

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

## Phase 1.10: Proxy 통합 + 실 CRAWL 활성화 + 프로덕션 배포·E2E
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.2, 1.8, **1.13 완료**
**스코프**: Phase 1.13의 런타임 재설계 코드를 전제로, 프록시(실제 IP 보호)를 갖춘 뒤 **실 CRAWL을 활성화하고 GCP(firebase)에 실배포하여 프로덕션 E2E까지 완결**한다. (Phase 1.9/1.13에서 이월된 프로덕션 실환경 검증을 본 Phase가 소유)

### 1) Proxy 통합
- [ ] ProxyScheduler 완성 (`crawlers/schedulers/ProxyScheduler.ts`)
  - [ ] `saveProxyList()` 구현 + ProxyStore(`providers/firebase/store/proxy.ts`)와 연결하여 Firestore 저장 — 현재 수집 결과가 TODO 주석으로 미저장 상태
  - [ ] 프록시 수집 실패 시 `error.critical` 이벤트 발행
- [ ] ProxyService 구현 (`services/proxyService.ts`): `getAvailableProxy` / `markProxyAsUsed` / `markProxyAsFailed` / `releaseProxy` / `hasAvailableProxy`
- [ ] SriaCrawler 프록시 통합 (`crawlers/strategies/recruit/sria/SriaCrawler.ts` — **Playwright 기반**)
  - [ ] Playwright에 프록시 주입: `browser.newContext({ proxy })` 또는 `chromium.launch({ proxy })` — ※ 기존 seed의 "axios/https-proxy-agent"는 실제 크롤러(Playwright)와 불일치하여 정정
  - [ ] 크롤 시작 전 `hasAvailableProxy()` 게이트 — 없으면 크롤 중단 + `proxy.unavailable` 발행
  - [ ] 프록시 실패 시 다른 프록시로 재시도(최대 3회), 전부 실패 시 중단 + `proxy.unavailable`
- [ ] Proxy 에러 처리 핸들러 (`features/proxyError/handlers/ProxyErrorHandler.ts`): `proxy.unavailable` 리스너 등록, 활성 구독자에 이용제한 안내 DM + 개발자 긴급 알림 DM
- [ ] DM 메시지 템플릿 (`features/proxyError/messages/templates.ts`)
  - 사용자용: "현재 서비스 이용에 일시적인 문제가 발생했습니다. 빠른 시일 내 복구하겠습니다."
  - 개발자용: "🚨 프록시 서버 전체 불가 - 크롤링 중단됨. 즉시 확인 필요"

### 2) IP 우회 스크래핑 전략 (차단 위험 완화)
프록시로 IP를 바꾸는 것만으로는 rate/fingerprint 기반 탐지를 못 피한다. 프록시 로테이션 + stealth 유지 + 차단 감지·백오프를 함께 계획해 실 CRAWL 중 IP 차단을 예방한다.
- [ ] 프록시 로테이션 정책 확정: 세션당 고정(기본) vs 요청마다 교체 vs 실패 시만 교체 — 사람인 세션/쿠키 일관성과 탐지 회피의 트레이드오프 평가 후 결정
- [ ] stealth 유지: 현재 `SriaCrawler`의 `playwright-extra` + `puppeteer-extra-plugin-stealth`(UA/핑거프린트 위장)를 프록시 컨텍스트에서도 유지. 프록시 geo와 `locale`/`timezoneId`/UA 정합성 확보 (불일치 시 오히려 탐지 위험 ↑)
- [ ] 요청 간 지터(jitter)·throttle: 고정 주기 대신 랜덤 지연으로 봇 패턴 완화. 기존 요청제한(`isRequestAllowed` 10분 쿨다운)과 정합
- [ ] 차단 감지·대응: 429 / CAPTCHA / 블록 페이지 / 비정상 응답(빈 목록·리다이렉트) 감지 → 해당 프록시 `markProxyAsFailed` + 다른 프록시 교체 + 지수 백오프 재시도, 연속 차단 시 `proxy.unavailable` 발행
- [ ] (선택) 차단율 로깅: 프록시별 성공/차단 카운트를 남겨 저품질 프록시 조기 배제

### 3) 실 CRAWL 활성화
- [ ] `app/index.ts` `initializeSchedulers({ recruitMode: CRAWL_MODE.CRAWL, enableProxy: true })`로 전환 (프록시 게이트가 IP 보호를 보장한 뒤에만)
- [ ] 실 CRAWL ToS/robots·개인정보 재확인 (License/Compliance)

### 4) 프로덕션 배포 & E2E (Phase 1.9/1.13 이월 검증 포함)
- [ ] `firebase deploy --only functions`로 GCP 실배포 (Blaze 요금제 전제; onSchedule → Cloud Scheduler 잡 자동 프로비저닝)
- [ ] 프로덕션 E2E: 실제 스케줄 주기에서 크롤(프록시 경유)→diff→DM 전체 플로우 검증. 진입 시 review-process 0단계처럼 체크리스트를 동적 생성:
  - [ ] R4 — ready race 해소: 첫 크롤이 ready보다 빨라도 DM 유실 없음 (실 타이밍 재현)
  - [ ] R5 — ready 로그 / HTTP 비결합 음성검증 / graceful shutdown 동작
  - [ ] DM 에러분기 — 50007(DM 차단/공유 길드 없음) graceful skip, rate limit(429) 대기·재시도
  - [ ] 부하·스트레스 — 구독자 수를 늘려가며 처리량·타임아웃 한계·429 발생 지점 측정. 순차 발송 시 `setTimeout`/`sleep` 블로킹이 실행시간·비용에 주는 영향 포함
  - [ ] 로그 수집 — `console.*`(providerLogger/systemLogger)가 Cloud Logging에 전 레벨(info/warn/error) 누락 없이 적재되는지, 심각도 매핑(error→ERROR, warn→WARNING), 핵심 이벤트(크롤 시작·완료, RECRUIT_NEW, NOTIFICATION_SEND/SENT, DM 성공/skip/실패) 추적, `firebase functions:log`/GCP 콘솔 조회 확인

**완료 기준**:
- [ ] SriaCrawler가 반드시 프록시를 통해서만 크롤링 수행 (프록시 없이는 크롤 절대 수행 안 함 — 실제 IP 보호)
- [ ] 프록시 1개 실패 시 다른 프록시로 자동 전환(최대 3회), 전부 불가 시 사용자·개발자 알림
- [ ] ProxyScheduler가 6시간마다 프록시 목록 갱신 및 Firestore 저장
- [ ] 프록시 로테이션 + stealth 유지 + 차단 감지·백오프로 실 CRAWL 중 IP 차단 없이 지속 수집
- [ ] GCP 실배포 후 실제 스케줄 주기에서 크롤→diff→DM 전체 파이프라인이 완결된다

---

## Phase 1.11: DebugLogger 마이그레이션 ✅ (완료)
**우선순위**: ⭐⭐
**의존성**: Phase 1.1 완료 (SystemLogger 구축)
**완료일**: 2026-02-09

- [x] 마이그레이션 현황 파악
  - [x] DebugLogger 사용 파일 전체 목록 작성 → 프로덕션 0개 확인
  - [x] 프로덕션 코드 마이그레이션 완료 확인 (41개 파일 globalLogger 사용 중)
  - [x] 테스트 파일 분석 (globalLogger.test.ts만 수정 필요)

- [x] LogSource 타입 및 프리셋 로거 추가
  - [x] `systemLogger.ts`에 LogSource 타입 정의 (`system`, `crawler`, `provider`, `EventBus`, `SystemError`, `ErrorHandler`)
  - [x] 프리셋 로거 export (crawlerLogger, providerLogger)
  - [x] `createGlobalLogger('provider')` 사용처 4곳 → providerLogger로 전환

- [x] 레거시 코드 정리
  - [x] `common/utils/logger.ts` 삭제
  - [x] `systemLogger.ts`에서 `import Logger` dead import 제거
  - [x] `common/types/global.d.ts`에서 DebugLogger 타입 선언 제거

- [x] 테스트 정리
  - [x] `globalLogger.test.ts`에서 DebugLogger 테스트 제거
  - [x] side-effect import 패턴 유지 확인 (`import "@/common/utils/systemLogger"`)

- [x] 마이그레이션 검증
  - [x] TypeScript 컴파일 확인 (`npx tsc --noEmit`) — 기존 에러 68개 유지, 새 에러 0개
  - [x] DebugLogger 잔여 참조 grep 검색 → 코드 0개 확인 (문서만 잔존)
  - [x] side-effect import 23개 파일 전환 완료

**완료 기준**: ✅ 모두 완료
- [x] logger.ts 삭제 완료
- [x] DebugLogger 전역 등록 및 타입 선언 제거
- [x] LogSource 타입 + 프리셋 로거 export
- [x] 모든 로그 정상 작동
- [x] TypeScript 컴파일 성공

**테스트 가이드라인**:
- 테스트 파일에서 전역 로거 사용 시 반드시 side-effect import 필요:
  `import "@/common/utils/systemLogger";`

**검토 문서**: [phase-1-11-review.md](../docs/reviews/phase-1-11-review.md)

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

**검토 문서**: [phase-1-12-review.md](../docs/reviews/phase-1-12-review.md)

**완료 기준**: ✅ 모두 완료
- [x] Events 레이어 구조 명확화 (bus, handlers, listeners)
- [x] 네이밍 충돌 제거 및 도메인 명시화
- [x] 기능별 상수 분리로 모듈화 강화
- [x] Import 경로 단순화 (@/events/* 만 필요)
- [x] 기술부채 감소 (불필요한 파일 정리)
- [x] TypeScript 컴파일 성공 (기존 에러 제외)

---

## Phase 1.13: 프로덕션 런타임 & 스케줄러 트리거 재설계 (미착수)
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.9 완료
**스코프**: 런타임 재설계 **코드까지 + 로컬 검증**. 실배포·실 CRAWL 활성화·프로덕션 E2E는 **Phase 1.10으로 이월**(프록시 IP 보호가 갖춰진 뒤 수행). onSchedule은 본 Phase에서 코드로 작성·정적검증하고, 실제 발화 검증만 1.10 배포에서 한다.

**배경**: 배포 타깃이 `onRequest` cold-start Cloud Functions라, 아래 두 가지가 프로덕션에서 동작하지 않는다. Phase 1.9는 이 때문에 "로컬 검증 한정"으로 축소되었고(startup wiring + 로컬 DUMMY 스케줄러 + ready 게이트 + env rename + emulator DM E2E), 실 CRAWL·프로덕션 구동은 Phase 1.10으로 이월됐다.
- `BaseScheduler`의 in-process `setTimeout` 스케줄러 → 응답 후 CPU 동결로 4시간 타이머가 발화하지 않는다.
- 봇이 gateway WebSocket에 의존 → dmSender(`client.users.fetch`)가 서버리스 틱과 비호환이다.

- [ ] 런타임 결정: warm-persistent(상시 프로세스) vs serverless(Cloud Functions) — design §1에 트레이드오프·비용·계약 영향 고정 후 승인
- [ ] 스케줄러 트리거를 `setTimeout` 루프 → `onSchedule`(Cloud Scheduler)로 전환 (코드; 실제 발화 검증은 Phase 1.10 배포에서)
- [ ] dmSender를 discord.js 클라이언트 의존 → REST 전용으로 전환 (DmPayload/DmSendResult 계약 불변 유지 — 1.9/1.10/2.1/2.2 공유 계약)
- [ ] 틱 완결 파이프라인: 한 번의 스케줄 실행이 크롤→diff→알림까지 await 완결되도록 보장
- [ ] **스케줄러 크롤 경로 재설계 (변경감지 정합성)**
  - 현재 `RecruitScheduler.performWork` → `recruitService.getRecruitList(mode)`는 3-tier(Redis → Firestore → 크롤) 순서로 읽는다.
  - Firestore `recruit/list`는 단일 canonical doc이고 TTL이 없어, 한 번 채워지면 Step2에서 항상 히트하고 Step4 실제 크롤에 도달하지 못한다. (→ 첫 크롤 이후 공고 변경 감지 불가)
  - 스케줄러 전용 `crawlAndDiff(mode)`로 분리 — Redis/Firestore 읽기 **우회 → 강제 크롤 → `setRecruitList` diff**(Redis hash 기준) → `RECRUIT_NEW`. 사용자 요청 경로(`getRecruitList` 3-tier)는 **보존**(회귀 방지).
  - (Phase 1.9 로컬 E2E는 이 경로를 우회하는 드라이버로 `setRecruitList`를 직접 호출해 검증했다.)
- [ ] **`crawlService.ts` DUMMY 하드코딩 버그 수정**: `sriagent()`가 실크롤 후 `getCityFilteredList(CRAWL_MODE.DUMMY, ...)`로 mode를 하드코딩해 스크랩 결과를 버린다. `getCityFilteredList(mode, city, scraped)`로 수정해 실 CRAWL 데이터가 필터로 전달되게 한다. (실 CRAWL **활성화**는 1.10이지만 mode 전달 **정합성**은 본 Phase에서 확보)

**검증** (정적 + 로컬, 배포 없음):
- 정적 analyze(매치율) + `tsc` + 계약(DmPayload/DmSendResult) 불변 확인
- 로컬 DUMMY 런타임 E2E: Phase 1.9 방식(setRecruitList 직접 호출 → EventBus → emulator DM)으로 dmSender REST 경로·`crawlAndDiff` 경로를 실제 동작 확인

**완료 기준**:
- [ ] onSchedule 진입점·dmSender REST·`crawlAndDiff`·틱 완결 파이프라인이 코드로 완성되고 정적 analyze 통과
- [ ] 로컬 DUMMY E2E에서 REST DM 수신 + `crawlAndDiff` diff 발행 확인
- [ ] 실배포·실 CRAWL·프로덕션 E2E는 범위 밖 (→ Phase 1.10)

---

*최종 수정: 2026-01-31*
*상위 문서: [TODO.md](./PROGRESS.md)*
*상태: Phase 1.1, 1.3, 1.12 완료 / Phase 1.2 진행 중 / Phase 1.4 대기*

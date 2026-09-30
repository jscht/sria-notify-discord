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
| Phase 1.10 | mock 데이터 프로바이더 재정의 + E안 배포 토폴로지 (proxy·실CRAWL 폐기) | ✅ | 0 | 0 |
| Phase 1.11 | DebugLogger 마이그레이션 | ✅ | 0 | 0 |
| Phase 1.12 | Events 아키텍처 통합 | ✅ | 0 | 0 |
| Phase 1.13 | 프로덕션 런타임 & 스케줄러 트리거 재설계 | ✅ | 0 | 0 |
| Phase 1.14 | 프로덕션 배포·운영 (E안 실배포 + 운영 갭 O-3~O-9) | 0 | 0 | (신규) |

> ⚠️ 위 완료/진행/대기 카운트는 참고용이며 **실제 상태 SoT는 `.claude/docs/pdca-status.json`**이다(이 표는 일부 stale). Phase 1.10에서 proxy·실 CRAWL은 **폐기**되고 mock 데이터 프로바이더로 재정의됐다(2026-09-28).

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

## Phase 1.10: mock 데이터 프로바이더 재정의 + E안 배포 토폴로지 ✅ (완료)
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.2, 1.8 완료
**완료일**: 2026-09-28 · 매치율 99.3% · 🔴 Critical 0
**스코프 (2026-09 pivot)**: proxy·실 CRAWL·IP 우회를 **폐기**하고(ToS/법적 리스크 회피 + 포트폴리오는 아키텍처 시연이 목적), **mock 데이터 프로바이더 아키텍처**로 재정의. 최소 base 스키마 + 사이트별 union, 소스별 스케줄·diff, crawl/proxy→source/sync 명칭 통일. 배포 배선(C-1) 갭은 **E안(하이브리드 2-프로세스)**로 해소.

- [x] 타입: `RecruitBase` + `SriaRecruit | TempRecruit` union, 다운스트림(~11파일) 치환
- [x] 프로바이더 계층: 레지스트리(`getProvider`) + sria 스냅샷 생성기 + temp 규칙엔진(stateless PRNG, 결정적 시뮬레이션)
- [x] 소스별 스케줄(`recruitSchedule_sria/_temp` onSchedule) + 소스별 diff 파티션(`{source}:` 접두사) + Redis 락(`lock:recruit:sync:{source}`)
- [x] 명칭 통일: `RECRUIT_SYNC_*`, `ErrorCategory.SOURCE`, `sourceLogger` (crawl/proxy 활성 심볼 0)
- [x] **C-1 해소 (E안)**: `package.json` main→`lib/app/scheduler.js`(트리거 배포 노출) + 게이트웨이 `app/gateway.ts`(**WS-only**, Oracle x86 Micro VM + pm2) 분리 + `bootstrapGateway` 공통화
- [x] 배포 설정: `.eslintrc.js` ESM→CJS, predeploy는 build만 게이팅(lint 분리), `build-deploy.md`·README에 E안 토폴로지·env 매트릭스 반영
- [x] 정적 검증: `tsc --noEmit` 0, `npm run build` 0, 스케줄 트리거 export 노출 확인

> **이월 (mock 스코프 밖)**: 실배포·실환경 E2E·운영 갭(O-3 Redis재연결·O-4 Secret Manager·O-5 seedCollection·O-6/O-9 구독자시드·슬래시커맨드 등록·E안 실배포 검증)은 **Phase 1.14(프로덕션 배포·운영)**로 귀속. 모니터링(A/B·MonitoringService)은 **Phase 2.1/2.2**. lint-cleanup·factory refactor·시간기반 백업은 `todo.md`. 문서드리프트 D-1·Code #1/#3은 본 사이클 정리에서 병합.

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

## Phase 1.13: 프로덕션 런타임 & 스케줄러 트리거 재설계 ✅ (완료)
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.9 완료
**완료일**: 2026-08-07 · 매치율 100% (archived, `docs/archive/phase-1-13/`)

> ⚠️ **아래 본문은 착수 당시 시드**다. 실제로는 완료됐고(C안 하이브리드: 인터랙션 gateway 상시 / onSchedule serverless, `setTimeout`→`onSchedule`, dmSender REST 전환, 틱 완결 파이프라인, `crawlAndDiff` 분리, RECRUIT_NEW→RECRUIT_CHANGED), 아래에서 **"실 CRAWL·프록시·Phase 1.10 이월"** 언급은 **mock pivot(2026-09)으로 폐기**됐다 — 실배포·실환경 E2E·운영 갭은 이제 **Phase 1.14**가 소유한다. `crawlService.ts` DUMMY 버그 등 크롤 잔재 항목도 mock 전환으로 무의미. SoT는 `pdca-status.json`.

**스코프(당시)**: 런타임 재설계 **코드까지 + 로컬 검증**. onSchedule은 본 Phase에서 코드로 작성·정적검증하고, 실제 발화 검증만 배포에서 한다.

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

## Phase 1.14: 프로덕션 배포·운영 (미착수)
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.10, 1.13 완료
**스코프**: E안(하이브리드 2-프로세스)을 **실제 프로덕션에 배포하고 실환경에서 검증**한다. Phase 1.10/1.13에서 이월된 운영 갭(CTO 운영감사 O-3~O-9)과 실배포 런타임 검증(U-1~U-4)을 소유. 대부분 **사용자 운영(U)** 항목이고 코드 수정은 소수.

### 코드 (Claude)
- [ ] **O-3 Redis 재연결**: Redis client에 `on("error")` + reconnectStrategy 추가 (상시 게이트웨이가 Upstash idle 끊김 시 크래시/플래핑 방지)
- [ ] **O-5 seedCollection**: `initFirebaseApp`가 cold init 실패 시 `process.exit(1)`로 인스턴스를 죽이는 경로 재검토
- [ ] (선택) lint predeploy 복구: lint-cleanup(todo) 완료 후 `firebase.json` predeploy에 `npm run lint` 재추가
- [ ] (선택) **O-7 timeZone**: onSchedule을 시각 기반 cron으로 바꿀 경우 `Asia/Seoul` 지정

### 운영 (사용자 · U)
- [ ] **O-4 Secret Manager** 🔴: Functions 프로덕션 시크릿(`FB_PRIVATE_KEY`/`DISCORD_BOT_TOKEN`)을 Firebase/GCP Secret Manager로 주입 (dotenv 무효). **미해결 시 실배포 런타임 실패**
- [ ] **O-6/O-9**: 게이트웨이 live 후 `npm run register:commands`(슬래시커맨드 prod 등록) → 구독 인터랙션으로 구독자 시드 확보 (DM 대상 존재 보장)
- [ ] **E안 실배포**: 스케줄러 = `firebase deploy`(Functions, Blaze) / 게이트웨이 = Oracle x86 Micro VM 프로비저닝 + pm2 상주(`pm2 start lib/app/gateway.js` + startup/save)
- [ ] **실환경 검증(U)**: U-3 실 onSchedule 트리거 발화 / U-1·U-2 게이트웨이 인터랙션 왕복 / U-4 에뮬·실 2-run E2E 실 DM (todo R4/R5)

**완료 기준**:
- [ ] 두 프로세스가 프로덕션에서 상시 가동, 실 스케줄 주기에서 sync→diff→DM 완결
- [ ] 인터랙션(슬래시/버튼)이 실 게이트웨이에서 왕복
- [ ] 시크릿·구독자 시드·Redis 재연결이 실환경에서 안정

> 모니터링(A/B·MonitoringService+채널)은 본 Phase가 아니라 **Phase 2.1/2.2**. 배포가 선행돼야 모니터 대상이 존재하므로 2.1이 1.14에 의존.

---

*최종 수정: 2026-09-28 (mock pivot + 1.13 완료 + Phase 1.14 신설 반영)*
*상위 문서: [TODO.md](./PROGRESS.md)*
*상태 SoT: `.claude/docs/pdca-status.json` (이 시드의 카운트는 참고용)*

# Phase 1.13 갭 분석: 프로덕션 런타임 & 스케줄러 트리거 재설계

**상태**: 🔍 검토 중
**분석일**: 2026-08-05
**설계서**: `docs/phase-1-13/02-design.md`

> **스코프**: 코드+정적/로컬 DUMMY 한정. onSchedule 실발화·실 CRAWL·REST 실전송·실배포·프로덕션 E2E·`crawlService.ts:28` DUMMY 버그(#6)는 **Phase 1.10 이월**, Firestore 크로스-프로세스 트리거 실배선은 **2.1/2.2 이월** — 미검증을 갭으로 계산하지 않음(design §6 경계).

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1 gateway 부트스트랩(스케줄러 제거) | `initGatewayProviders().then(registerAllEventHandlers)`, `initializeSchedulers` 부재 | ✅ | `app/index.ts:20-29` |
| S2 | §2.1 `app/scheduler.ts` 신규 + `onSchedule` | `recruitSchedule = onSchedule("every 4 hours", …)` + env 게이팅 | ✅ | `app/scheduler.ts:19,25` |
| S3 | §2.1 `initGatewayProviders()` | Firebase+Redis+`initDiscordBot`, 메모이즈 | ✅ | `providers/index.ts:15-31` |
| S4 | §2.1 `initFunctionProviders()` | Firebase+Redis+`initDiscordRest`, 메모이즈 | ✅ | `providers/index.ts:37-53` |
| S5 | §2.5 `rest` + `initDiscordRest()` | `new REST({version:"10"})` + `setToken` 분리, index export | ✅ | `discord/client.ts:12-17`, `discord/index.ts:2` |
| S6 | §2.3 `emitEventAndSettle<T>` additive | 존재, 기존 `emitEvent` 시그니처 불변 | ✅ | `events/bus/EventBus.ts:88` |
| S7 | §2.4 공용 `emitRecruitNewEvent(diff,source,opts)` + export | 신규 파일 + barrel export | ✅ | `bus/utils/emitRecruitNewEvent.ts:16`, `bus/index.ts:22` |
| S8 | §2.4 `setRecruitList` 반환 `{status,diff}` + `CacheUpdateStatus` 승격 | 반환 확장, enum 모듈 상단 export | ✅ | `recruitCacheService.ts:10-14,38-40,88` |
| S9 | §2.4-4 `acquireLock`/`releaseLock` | `SET NX PX` + Lua CAS 해제 | ✅ | `redisManager.ts:69,78` |
| S10 | §2.4 `crawlAndDiff(mode): Promise<JobDiffResult>` | 존재 | ✅ | `recruitService.ts:98` |
| S11 | §2.2 `BaseScheduler.runOnce(): Promise<WorkResult>` 추출 | STARTED→performWork→COMPLETED/FAILED, 재스케줄 없음 | ✅ | `BaseScheduler.ts:49` |
| S12 | §2.2 `SchedulerManager.runRecruitOnce(mode)` | `runOnce()` 반환 | ✅ | `SchedulerManager.ts:49` |
| S13 | §2.2 `RecruitScheduler.performWork` → `crawlAndDiff` | `getRecruitList` 미사용, `crawlAndDiff(this.mode)` | ✅ | `RecruitScheduler.ts:39` |

**Structural = 13/13 완전일치 → 100%**

### 1.2 Functional (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.3 틱 완결 await 체인 (crawlAndDiff→RECRUIT_NEW→notifyNewRecruits가 NOTIFICATION_SEND await→dmSender) | Hop1·Hop2 promise 전 구간 연결 | ✅ | `recruitService.ts:115`, `NotificationEventHandler.ts:18`, `notificationService.ts:37`, `NotificationSendHandler.ts:28` |
| F2 | §2.2 `runOnce` 내 `scheduleNextExecution` 미호출(단일 tick) | 루프는 `startWork`/`scheduleNextExecution`에만 격리 | ✅ | `BaseScheduler.ts:49-118` vs `41,123-136` |
| F3 | §2.4 `crawlAndDiff` 3-tier 우회(강제 크롤) | `crawler.sriagent(mode)` 직접, 캐시 read 없음 | ✅ | `recruitService.ts:108` |
| F4 | §2.4 city 미지정 전체 스코프 | `sriagent(mode)` city 미전달 | ✅ | `recruitService.ts:108` |
| F5 | §2.4-4 Redis 분산 락 원자성 | `acquireLock(60s)` 가드 + `finally releaseLock` + 미획득 스킵 | ✅ | `recruitService.ts:100-120` |
| F6 | §2.4-3 `getRecruitList` 두 백업부 CHANGED 알림 재현 | Step2 + `collectAndSaveRecruits` 둘 다 `.then(CHANGED && emit{awaitSettle:false})` | ✅ | `recruitService.ts:62-70,135-143` |
| F7 | §2.4-5 NO_DATA 미발행(기준선 부재) | NO_DATA 분기 emit 없음(warn 격상), `crawlAndDiff`는 CHANGED만 | ✅ | `recruitCacheService.ts:66-70`, `recruitService.ts:114` |
| F8 | §2.5 dmSender 2-step REST + ready 빗장 제거 | `rest.post(userChannels)`→`rest.post(channelMessages)`, `getDiscordReady`/`users.fetch` 삭제 | ✅ | `dmSender.ts:134-140` |
| F9 | §2.4-1 내부 emit 제거·diff/persist 원자 순서 유지 | 내부 `emitEvent` 부재, 단일 메서드 원자 순서 유지 | ✅ | `recruitCacheService.ts:57-88` |
| F10 | §2.3 `emitEventAndSettle` 리스너 promise 수집·allSettled | `listeners(event).map(l=>l(payload))`→`Promise.allSettled` | ✅ | `EventBus.ts:88-93` |

**Functional = 10/10 완전일치 → 100%**

### 1.3 Contract (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | §1.2 `DmPayload`/`DmSendResult` 시그니처·필드 불변 | `sendNotificationDM(userId,payload):Promise<DmSendResult>` + 필드 전부 유지 | ✅ | `dmSender.ts:12-37,122-125` |
| C2 | §1.2 `getRecruitList` 3-tier 본문 무회귀 | read/return 로직 미변경, 백업 write에 `.then` emit 배선만(§2.4-3 지시) | ✅ | `recruitService.ts:37-91` |
| C3 | §1.0 `onInteraction.ts`/`discordListeners.ts` 무변경 | git diff 없음 | ✅ | — |
| C4 | §3.2 `emitEvent`·`EventPayloadMap` 불변(additive만) | 기존 `emitEvent` 그대로, `emitEventAndSettle` 추가만 | ✅ | `EventBus.ts:70-93` |
| C5 | §3.2 이벤트 페이로드 불변 | RECRUIT_NEW/NOTIFICATION_SEND/SENT 필드 동일, 발행 위치만 이관 | ✅ | `types.ts`, `emitRecruitNewEvent.ts:21` |
| C6 | §2.5 provider throw 금지·결과 흡수 | 전 분기 `DmSendResult` 반환 | ✅ | `dmSender.ts:144-218` |
| C7 | §2.5-4 에러코드 매핑 보존(50007/10013/429) | `getErrorCode`·`getRateLimitWaitMs` 무수정 재사용, 2-step 단일 try | ✅ | `dmSender.ts:60-89,145-207` |
| C8 | §2.1 gateway ready 빗장 존치 | `discordReady`/`markDiscordReady` gateway 존치, dmSender만 대기 제거 | ✅ | `discordReady.ts`, `initDiscordBot.ts` |

**Contract = 8/8 완전일치 → 100%**

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 13/13 | 100% |
| Functional (×0.4) | 10/10 | 100% |
| Contract (×0.4) | 8/8 | 100% |
| **종합 매치율** | | **100.0%** |

```
종합 매치율 = 100×0.2 + 100×0.4 + 100×0.4 = 100.0%
```

---

## 3. 갭 목록

### 3.1 미구현 항목
**실질 갭 없음** (🔴 0 / 🟡 0 / 🟢 0). 이월 항목은 스코프 밖으로 분모 미포함.

### 3.2 설계 차이
| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| D1 | §2.4-2 락 범위 "diff 계산~저장 구간" | 락이 crawl+diff+persist+`emitEventAndSettle`(DM 브로드캐스트 await)까지 확장. TTL 60s 고정 | 허용(원자성 보장 초과 달성) — 단 §4 이슈 #1로 트레이드오프 기록, 1.10 실측 이월 |
| D2 | §2.4 크롤 결과 diff 반영 | 빈-크롤 결과 시 `setRecruitList` 스킵 가드 추가 | 허용(설계 초과 안전장치 — 오삭제 방지 정합) |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록
| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟡 Warning | 동시성/성능 | `recruitService.ts:100-120` | 락이 `awaitSettle:true`로 DM 브로드캐스트 전 구간을 감싸는데 TTL 60s 고정 → 구독자 다수/느린 크롤 시 작업 중 락 조용히 만료. persist가 emit보다 선행해 중복알림 실피해는 낮고 onSchedule 4h 주기라 동시 진입 희소 | 락 범위를 persist까지로 축소 후 emit 전 해제, 또는 TTL 재산정. 최소 report에 1.10 실측 이월로 명시 |
| 2 | 🟢 Info | 컨벤션 | `recruitService.ts:102` | 락 TTL `60_000` 매직넘버 | `CRAWL_LOCK_TTL_MS` 상수 추출 |
| 3 | 🟢 Info | 견고성 | `recruitCacheService.ts`, `RecruitScheduler.ts` | `import "@/common/utils/systemLogger"` side-effect 임포트 누락(전역 등록+로드 순서로 런타임 동작하나 파일 간 일관성 결여) | 두 파일 최상단 임포트 추가 |
| 4 | 🟢 Info | DRY | `recruitService.ts:62-70`·`135-143` | `.then(CHANGED && emit).catch(warn)` gating 래핑 2회 복제(emit 자체는 헬퍼로 dedup됨) | private `backupWriteAndEmit(list)` 추출 |
| 5 | 🟢 Info | 데드코드 | `SchedulerManager.startRecruitScheduler`/`start·stopProxyScheduler`, `initializeSchedulers`, `setupGracefulShutdown` | gateway 진입점에서 호출 제거 후 live 호출처 없음(프로덕션은 `runRecruitOnce`로 전환). `startWork` 로컬 cadence 경로도 진입점 끊김 | 버그 아님(설계 로컬 보존 의도). report에 "로컬 실행은 `RUN_SCHEDULER_ONCE=true` 단발 대체"로 명기 or 정리 |
| 6 | 🟢 Info | 견고성 | `EventBus.ts:91` | `listeners.map(l=>l(payload))` — 동기 리스너 동기 throw 시 allSettled 격리 우회(현 핸들러는 전부 async라 안전) | `Promise.resolve().then(()=>l(payload))` 래핑 |
| 7 | 🟢 Info | 동시성 | `recruitService.ts:119` | `finally releaseLock`가 Redis 장애로 throw 시 성공 결과 덮어써 `RECRUIT_CRAWL_FAILED` 오발행 | `releaseLock` try-catch(warn) 감싸기 |
| 8 | 🟢 Info | 컨벤션 | `recruitService.ts:6-11` | value/type 임포트 혼재 | type 그룹 재정렬 |

### 4.2 컨벤션 준수
| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger 사용(`console.*` 금지) | ✅ | 전 파일 준수 |
| provider throw 금지(결과 흡수) | ✅ | dmSender 전 분기 `DmSendResult` |
| 핸들러 try-catch·재throw 금지 | ✅ | Notification 핸들러 대칭 |
| JSDoc(public API) | ✅ | runOnce/crawlAndDiff/emitEventAndSettle/initFunctionProviders/acquireLock/releaseLock |
| EventBus 타입 안전 제네릭 | ✅ | `emitEvent<T>`/`emitEventAndSettle<T>` |
| 네이밍 규칙 | ⚠️ | `60_000` 매직넘버(#2)만 예외 |
| side-effect 임포트 일관성 | ⚠️ | 2개 파일 누락(#3) |
| import 정리 | ⚠️ | #8 |
| 보안(토큰·락·REST body) | ✅ | 하드코딩·로그유출 없음, `crypto.randomUUID`+Lua CAS, 주입 위험 없음 |

### 4.3 요약
- 🔴 Critical: 0건
- 🟡 Warning: 1건 (#1 락 범위/TTL — 설계가 이미 인지·이월한 블로킹 트레이드오프)
- 🟢 Info: 7건 (폴리시·저위험, 정리 커밋/iterate 일괄 처리 가능)
- `npx tsc --noEmit`: **exit 0 (에러 0)** — 독립 재확인 포함 2회 통과

---

## 5. 다음 단계 분기

✅ **매치율 100% (≥90%) AND 🔴 Critical 0** → `/pdca report 1.13` 진행 가능
- CTO Lead 게이트: 매치율 ≥90% + Critical 0 → **호출 생략**(비용 절감 규칙)
- 🟡 #1 및 🟢 7건은 **매치율 미차감** — report의 "알려진 제약/후속 정리" 항목으로 기록. #1은 1.10 실측과 함께 재검토.
- (선택) 로컬 DUMMY E2E 런타임 검증(`RUN_SCHEDULER_ONCE=true`)은 사용자 실행 사항 — 원하면 report 전 수행 가능(강제 아님).

---

*분석일: 2026-08-05*
*참고: docs/phase-1-13/02-design.md*

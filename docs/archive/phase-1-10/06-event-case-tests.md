# Phase 1.10 — 이벤트 케이스 테스트 기록 (0단계 보강)

> 목적: mock 파이프라인에서 **발생 가능한 다양한 이벤트 케이스**를 열거하고, 각 케이스의 검증 방법·결과를 기록한다.
> 분류: **(C)** Claude 실행·판정(외부 부작용 없음) / **(U)** 사용자만(봇 상시기동·실 DM·과금).
> 기록일: 2026-09-23. 근거 = 구현 코드(SoT).

## 실행 하네스 (세션 scratchpad — 재현용)

| 하네스 | 커버 | 실행 |
|--------|------|------|
| `verify.ts` | MC-C2~C9 (temp 규칙엔진·소스 diff·병합·임베드) | `TSX_TSCONFIG_PATH=./tsconfig.json npx tsx verify.ts` (REDIS_URL 더미) → **17/17 PASS** |
| `verify-events.ts` | 이벤트 분기(B/D/E) + A3(락)·D4(enabled)·G2(장애) | 동일 실행(functions cwd, .env 로드) → **30/30 PASS** |
| MC-U1 update-run (pass1→2) | `updated → 실 DM` E2E | 대구 공고 수정 → `updated:1` → 구독자 실 DM (아래 B4) |
| 콘솔 테스트 3종 | systemError / EventBus / BaseScheduler | `tsx` 직접 → PASS (MC-C1) |
| MC-U1 (런타임) | 소스별 2-run E2E | `RUN_SCHEDULER_ONCE=true node lib/app/scheduler.js` → run1 무DM / run2 실 DM |

> ⚠️ 로컬 스케줄러 E2E는 `npm run serve`가 아니라 **`node lib/app/scheduler.js`**로 실행한다(`main=index.js`는 게이트웨이라 스케줄러 미로드). 상세: `05-runtime-verification.md`.

---

## A. 동기화 흐름 (sync lifecycle)

| # | 케이스 | 기대 | 검증 | 결과 |
|---|--------|------|------|------|
| A1 | 정상 동기화 | `sync:started`→`completed`, 캐시 반영 | MC-U1 run1/2 | ✅ PASS |
| A2 | 동기화 실패 | `sync:failed` 발행, 무DM | `BaseScheduler.test`(MC-C1) | ✅ PASS(기존) |
| A3 | 락 경합 | `lock:recruit:sync:{source}`(60s) 보유 시 2번째 skip | verify-events `[A3]`(실 Redis: 획득→경합 null→해제→재획득) | ✅ PASS |

## B. diff 판정 (CacheUpdateStatus)

| # | 케이스 | 기대 | 검증 | 결과 |
|---|--------|------|------|------|
| B1 | NO_DATA | 캐시만·`changed` 미발행·무DM | MC-U1 run1 + verify-events(B2 1차) | ✅ PASS |
| B2 | UNCHANGED | 무이벤트·무DM | verify-events `[B2]` | ✅ PASS |
| B3 | added only | `changed`(added≥1)→DM | MC-U1 run2(sria 대구 added→실 DM) | ✅ PASS |
| B4 | updated only | `changed`(updated≥1)→DM | **update-run pass2**: 대구 공고 수정→`updated:1`→**실 DM 수신**(구독자 1159…018) + verify-events `[B4n]`(로직) | ✅ PASS |
| B5 | **deleted only** | `changed`(deleted≥1) 발행하나 **무DM**(notify 대상=added+updated) | verify-events `[B5]`+`[B5n]` | ✅ PASS |
| B6 | mixed | added+updated+deleted 동시, added+updated만 DM | verify-events `[B6]` | ✅ PASS |

> **경계 확인(B5)**: 삭제만 있으면 `recruit:changed`는 발행되나 `notifyNewRecruits` targetJobs=added+updated라 DM은 0건 — 의도된 동작으로 확정.
> **정정(B4)**: 초기 기록은 run2의 temp `updated:5`로 B4를 통과 표기했으나, 그 updated 공고들은 대구 구독자 필터에 안 걸려 실제 DM으로 전달되지 않았다(수신 DM 2건은 모두 `added` 기반). 이를 바로잡아 **update-run pass2**에서 대구 공고를 직접 수정해 `updated:1`만으로 **변경 DM 실수신**을 확인함.

## C. 소스 파티션 격리

| # | 케이스 | 기대 | 검증 | 결과 |
|---|--------|------|------|------|
| C1 | 소스별 diff 격리 | `setRecruitList(list,"temp")` 시 sria 파티션 미삭제 | verify.ts MC-C7 | ✅ PASS |
| C2 | 한 소스만 CHANGED | temp만 DM·sria 무영향 | MC-U1 run2 | ✅ PASS |

## D. 알림 필터 (구독자별)

| # | 케이스 | 기대 | 검증 | 결과 |
|---|--------|------|------|------|
| D1 | SELECTED+지역매칭 | 해당 구독자 DM | verify-events `[D2/D3]`+MC-U1 run2(대구) | ✅ PASS |
| D2 | SELECTED+지역불일치 | matchedJobs=0→무DM | verify-events `[D2]`+`[D2n]` | ✅ PASS |
| D3 | ALL 모드 | 전체 변경공고 DM | verify-events `[D3]` | ✅ PASS |
| D4 | enabled=false | `getAllActiveSubscribers`(where enabled==true)에서 제외 | verify-events `[D4]`(실 읽기: 반환 전부 enabled=true) + `subscription.ts:124` where절 | ✅ PASS |
| D5 | 구독자 0명 | `changed` 발행하나 DM 0 | verify-events `[D5]` | ✅ PASS |
| D6 | 다중 구독자 | 각자 필터대로 개별 DM(ALL 2건/대구 1건) | verify-events `[D6]` | ✅ PASS |

## E. DM 발송 결과 (dmSender 분기)

| # | 케이스 | 기대 | 검증(rest.post 몽키패치) | 결과 |
|---|--------|------|--------------------------|------|
| E1 | 성공 | `{ok:true, attempts:1}` | verify-events `[E1]` | ✅ PASS |
| E2 | 50007 DM차단 | graceful skip `{skipped:true, dm_disabled}` 재시도 없음 | `[E2]` | ✅ PASS |
| E3 | 10013 unknown user | `{unknown_user}` 재시도 없음 | `[E3]` | ✅ PASS |
| E4 | 429 rate limit | 대기(ms) 후 재시도 → 2회차 성공 | `[E4]` | ✅ PASS |
| E5 | 미지 코드 | backoff 재시도 소진 → `{max_retries, attempts:3}` | `[E5]` | ✅ PASS |

> E2/E4는 로직을 모킹으로 검증. 실제 차단 계정·실 429 관찰은 (U)로 별도 필요 시 수행.

## F. temp 규칙엔진 시간전개

| # | 케이스 | 기대 | 검증 | 결과 |
|---|--------|------|------|------|
| F1 | spawn(생성) | 40/10/2/48% 근사 | verify.ts MC-C2 | ✅ PASS(40.1/10.2/2.0/47.7) |
| F2 | progression(수정) | 진행도 확정 감소=updated | verify.ts MC-C3 + MC-U1 run2 | ✅ PASS |
| F3 | expiry(확정삭제) | lifespanTicks 종료=deleted | verify.ts MC-C4 | ✅ PASS |
| F4 | 확률삭제 영구성 | firstDeathTick 이후 재등장 0 | verify.ts MC-C5 | ✅ PASS |
| F5 | 경계내 결정성 | 같은 now→동일 목록 | verify.ts MC-C6 | ✅ PASS |

## G. 인프라 장애

| # | 케이스 | 기대 | 상태 |
|---|--------|------|------|
| G1 | Redis 다운 | fallback / 전역 에러핸들러 | ⏸ (U)·장애주입 필요 |
| G2 | Firestore 다운 | 핸들러 try-catch 흡수, tick 안정 | ✅ PASS (verify-events `[G2]`: getAllActiveSubscribers throw → unhandledRejection 0) |

---

## 보류(⏸) 항목과 사유

| 항목 | 사유 | 향후 |
|------|------|------|
| G1 Redis 다운 | 실 인프라 다운(장애주입) 재현 필요 — (U) | 필요 시 사용자 실행 |
| OP-U1 배포 트리거 | 실배포 + `main=index.js` 스케줄 트리거 export 리스크 | analyze/OP-U1에서 확인(사용자 지시로 보류) |

> A3/D4/G2는 2차 보강에서 완료(위 표 반영). B4는 update-run pass2로 변경 DM 실수신까지 확인.

## 종합

- 이벤트 케이스 하네스: **30/30 PASS** (B2/B4n/B5/B6, D1~D6, E1~E5, A3, D4, G2). 누적 (C): 콘솔 3 + verify 17 + verify-events 30 = **50건**.
- (U) 런타임: MC-U1 run1/run2(NO_DATA·added→DM) + **update-run pass2(updated→변경 DM 실수신)**.
- 남은 보류는 G1(Redis 다운·U)·OP-U1(배포)뿐 — 앱 로직 결함 아님, 실 인프라/배포가 필요한 항목.

*작성일: 2026-09-23 (2차 보강: A3/D4/G2 완료, B4 update-run 정정)*
*연계: 05-runtime-verification.md (MC-C/U 목록), pdca analyze(설계↔구현)*

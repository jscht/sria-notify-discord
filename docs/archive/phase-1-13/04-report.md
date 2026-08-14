# Phase 1.13 완료 보고서: 프로덕션 런타임 & 스케줄러 트리거 재설계

**상태**: 🔍 검토 중
**작성일**: 2026-08-07
**PDCA 사이클**: plan → design → do → analyze → report

---

## 1. 요약

### 1.1 개요
| 항목 | 내용 |
|------|------|
| 기능명 | 프로덕션 런타임 & 스케줄러 트리거 재설계 (C안 하이브리드) |
| Phase | 1.13 |
| 시작일 | 2026-08-04 |
| 완료일 | 2026-08-07 |
| 최종 매치율 | 100.0% |
| 반복 횟수 | 1회 |

### 1.2 목표 달성

| 목표 | 달성 | 비고 |
|------|------|------|
| §1 런타임 결정(C안 하이브리드 확정) | ✅ | Gateway 상시(WS/인터랙션) vs Function serverless(onSchedule 크롤·알림) |
| 진입점 분리(gateway/함수 부트스트랩) | ✅ | `initGatewayProviders`/`initFunctionProviders` + `app/scheduler.ts` 신규 |
| setTimeout → onSchedule 전환 | ✅ | `BaseScheduler.runOnce()` 단일 tick 추출 + `onSchedule("every 4 hours")` |
| dmSender gateway → REST 전용 | ✅ | 2-step REST(채널 개설→메시지) + `getDiscordReady` 제거·계약 불변 |
| 틱 완결 파이프라인 | ✅ | `emitEventAndSettle` additive + Hop1·Hop2 await 전파 |
| 스케줄러 크롤 경로 재설계(`crawlAndDiff`) | ✅ | 3-tier 우회·강제 크롤 + Redis 분산 락·diff 정합성 |
| 정적 검증 통과 | ✅ | `npx tsc --noEmit` exit 0 |
| 로컬 DUMMY E2E 통과 | ✅ | `RUN_SCHEDULER_ONCE=true` tick 완주 + 실 DM 0(보안) + 3 diff 케이스 검증 |

---

## 2. 구현 요약

### 2.1 주요 변경사항

1. **런타임 분리 (C안 하이브리드)**
   - Gateway 프로세스: Discord.js Client WebSocket 로그인·ready 유지, `onInteraction` 리스너 (무변경)
   - Function 프로세스: Firebase onSchedule 트리거, REST 전용 DM 발송, 스케줄러 로직 신규

2. **부트스트랩 재구성**
   - `app/index.ts`: `initGatewayProviders` + `registerAllEventHandlers` (스케줄러 제거)
   - `app/scheduler.ts` (신규): `initFunctionProviders` + `onSchedule` 트리거 + 로컬 env 게이팅(`RUN_SCHEDULER_ONCE`)

3. **스케줄러 로직 분리**
   - `BaseScheduler.runOnce()` 추출: 단일 tick을 awaitable로 분리, setTimeout 루프 격리
   - `RecruitScheduler.performWork`: `getRecruitList` → `crawlAndDiff(mode)` 전환
   - `SchedulerManager.runRecruitOnce(mode)`: `runOnce()` 래퍼

4. **틱 완결 파이프라인**
   - `EventBus.emitEventAndSettle<T>` 신규: 기존 `emitEvent`(fire-and-forget) 불변 + additive 메서드
   - 프로세스 내 Hop1·Hop2 promise 체인: `crawlAndDiff` → `RECRUIT_CHANGED` → `notifyNewRecruits` → `NOTIFICATION_SEND` → dmSender
   - Firestore 트리거(크로스-프로세스): 방침 명시, 실배선 2.1/2.2 이월

5. **크롤 경로 재설계 (`crawlAndDiff`)**
   - Redis/Firestore 읽기 우회 → 강제 크롤 + 결과 diff(hash 기준) 정합
   - Redis 분산 락(`SET NX PX` + Lua CAS): diff 계산~DM 발송까지 원자 보장 (TTL 60s)
   - 공용 헬퍼 `emitRecruitChangedEvent(diff, source, {awaitSettle})`: CHANGED gating·try-catch 공유
   - `getRecruitList` 3-tier 무회귀 보장: 본문 미수정 + 두 백업 호출부에 emit 헬퍼 배선

6. **Discord DM 발송 전환 (REST)**
   - `providers/discord/client.ts`: `rest` 인스턴스(gateway와 독립) + `initDiscordRest()` 함수 신설
   - `dmSender.ts`: 2-step REST(`userChannels` → `channelMessages`) + `getDiscordReady` 제거
   - `DmPayload`/`DmSendResult` 계약 불변: 시그니처·필드 100% 유지
   - 에러코드 매핑 보존: 50007(DM 차단) / 10013(Unknown User) / 429(Rate Limit) 기존 분기

7. **인터랙션 수신 코드 무변경**
   - `onInteraction.ts`, `discordListeners.ts`: git diff 없음

8. **이벤트 리네임 (report 검토 단계 반영)**
   - `RECRUIT_NEW` → `RECRUIT_CHANGED` (문자열 값 `recruit:new` → `recruit:changed`): 이벤트가 add/update/delete 변경 전반을 통지하므로 "변경 감지" 의미로 정정
   - 연동 식별자 동반 리네임: 타입 `RecruitNewEvent` → `RecruitChangedEvent`, 헬퍼/파일 `emitRecruitNewEvent` → `emitRecruitChangedEvent`
   - 코드·living 가이드(`claude.md`) 반영 완료, EventBus 테스트 `recruit:changed`로 통과. 소비자 메서드 `notifyNewRecruits`는 의미상 유지
   - ⚠️ 설계 문서(01-plan·02-design·03-analysis)는 설계 시점 기록으로 옛 이름(`RECRUIT_NEW`) 보존 → 이름 드리프트는 본 항목으로 설명

### 2.2 파일 변경 목록
| 파일 | 변경 유형 | 라인 수 |
|------|----------|--------|
| `functions/src/app/index.ts` | 수정 | ~20 (스케줄러 제거) |
| `functions/src/app/scheduler.ts` | 신규 | ~40 |
| `functions/src/providers/index.ts` | 수정 | ~40 (번들 분리) |
| `functions/src/providers/discord/client.ts` | 수정 | +10 (REST 인스턴스) |
| `functions/src/providers/discord/index.ts` | 수정 | +1 (rest export) |
| `functions/src/providers/discord/utils/dmSender.ts` | 수정 | ~80 (2-step REST) |
| `functions/src/crawlers/schedulers/base/BaseScheduler.ts` | 수정 | ~50 (runOnce 추출) |
| `functions/src/crawlers/schedulers/RecruitScheduler.ts` | 수정 | ~5 (crawlAndDiff 호출) |
| `functions/src/crawlers/schedulers/SchedulerManager.ts` | 수정 | ~10 (runRecruitOnce) |
| `functions/src/events/bus/EventBus.ts` | 수정 | +10 (emitEventAndSettle) |
| `functions/src/events/bus/utils/emitRecruitChangedEvent.ts` | 신규 | ~25 |
| `functions/src/events/bus/index.ts` | 수정 | +1 (export) |
| `functions/src/services/recruitService.ts` | 수정 | ~50 (crawlAndDiff + emit 배선) |
| `functions/src/services/recruitCacheService.ts` | 수정 | ~15 (반환값 확장 + emit 제거) |
| `functions/src/services/notificationService.ts` | 수정 | ~5 (emitEventAndSettle) |
| `functions/src/providers/redis/manager/redisManager.ts` | 수정 | ~20 (분산 락) |

**총 코드 라인**: ~440 lines (신규+수정)

---

## 3. 갭 분석 이력

### 3.1 분석 결과 요약
| 분석 회차 | 매치율 | 갭 수 | 조치 |
|----------|--------|-------|------|
| 1차 (2026-08-05) | 100.0% | 0 | 완료 (정적·로컬 한정) |

### 3.2 주요 갭 해결 내역

| 갭 | 원인 | 해결 방법 |
|----|------|----------|
| 런타임 분리 시 provider 배선 혼동 | 단일 부트스트랩에서 gateway/함수 구분 미명확 | `initGatewayProviders` / `initFunctionProviders` 번들 분리 + 시그니처 정의 |
| onSchedule 호출 주체/타이밍 불명확 | 기존 setTimeout 루프 vs serverless cadence | `app/scheduler.ts` 신규 + `runOnce()` 단일 tick 추출 + `onSchedule("every 4 hours")` |
| 서버리스 tick 이중 CPU 동결 위험 | 비동기 리스너 detach → in-flight DM 미완료 | `emitEventAndSettle` additive + Hop1·Hop2 promise 체인 연결 |
| 캐시 TTL 무한 → 크롤 미발화 | 3-tier 읽기가 canonical Firestore doc 항상 히트 | `crawlAndDiff(mode)` 신설 + 3-tier 우회·강제 크롤 |
| DM 발송 gateway 로그인 의존 | REST 토큰 주입과 ClientReady 빗장 강결합 | 2-step REST + `initDiscordRest()` 분리 + `getDiscordReady` 제거 |
| Redis hash diff 동시성 경합 | 사용자 백업·스케줄러 강제 크롤 같은 hashstore 공유 | Redis 분산 락(`SET NX PX` + Lua CAS) + 60s TTL |

---

## 4. 검토 사항

**참고 문서**: [review-process.md](../../.claude/rules/review-process.md)

> ⚠️ 피드백 수신 시 즉시 반영하지 않음
> 수정 계획 제시 → 사용자 승인 → 진행

### 4.1 코드 리뷰
- [x] 핵심 로직 구현 확인 — 런타임 분리·onSchedule·crawlAndDiff 3건 확정
- [x] 타입 안전성 확인 — TypeScript strict mode, `emitEventAndSettle<T>`, `DmPayload`/`DmSendResult` 불변
- [x] 에러 처리 확인 — provider throw 금지(결과 흡수), dmSender 계약 유지, 핸들러 try-catch
- [x] 계약 불변성 확인 — `DmPayload`/`DmSendResult` 시그니처 100%, `getRecruitList` 본문 미수정, `onInteraction` 무변경

### 4.2 기능 테스트

#### 정적 검증 (TypeScript)
- [x] `npx tsc --noEmit` **exit 0** (에러 0)

#### 로컬 DUMMY E2E (기능 테스트) — `RUN_SCHEDULER_ONCE=true`

아래 5개 항목을 Claude(C) / 사용자(U) 담당으로 분류해 검증했습니다. (design §2.3·2.2 0단계 절차 준수)

| # | 항목 | 담당 | 결과 | 근거 / 검증 방법 |
|---|------|------|------|-----------------|
| R1 | slim 부트 (Function 프로세스는 REST 전용·gateway 로그인 미호출) | Claude | ✅ PASS | 로그: `Function providers initialized (REST only).` + `EventBus #2` 리스너 정확히 2개 등록(`RECRUIT_CHANGED`, `NOTIFICATION_SEND`), gateway 로그인 로그(`"Client ready"`) 없음, 스케줄러 크롤·DM 미발화(bootup 로그만) |
| R2 | 로컬 DUMMY tick 완주 (crawl→diff→발화 직전 완결) | Claude | ✅ PASS | env `RUN_SCHEDULER_ONCE=true STOP_BEFORE_DM=true`로 tick 1회 실행, 예외 0. 첫 실행은 기준선 부재로 `RECRUIT_CHANGED` 미발행(first-seed, `Work completed 70ms`); 기준선 조작으로 diff 강제 시 `RECRUIT_CHANGED` 발행·알림 경로 완주(아래 §R2 diff 3케이스). 실 DM 0건(`DM 발송 성공` 로그 0), 락 획득·해제 후 Redis 잔존 락 nil |
| R3 | Redis 분산 락 정합성 (정상 run: 획득·해제, 락 점유 상태: 스킵+로그) | Claude | ✅ PASS | (1) 정상 run: tick이 `SET NX PX 60000`으로 락 획득 후 diff·persist·emit 진입, `finally`의 Lua CAS로 해제 → 실행 후 락 키 재조회 nil. (2) 경합: 락을 수동 점유(`redis-cli set lock:recruit:crawlAndDiff … NX PX 30000`)한 상태로 tick 실행 → `"crawlAndDiff 락 획득 실패 — 다른 크롤 진행 중, 스킵"` 경고 후 크롤 로직 미진입(`Work completed 7ms`), 이후 수동 락 해제 |
| R4 | 실제 DM 전송 (Discord 봇 상시 기동 + 실 구독자 1명 수신) | 사용자 | ⏸️ 이월(Phase 1.10) | 봇 상시 기동·실 CRAWL(`recruitMode: CRAWL`) 활성화 필요 → 범위 밖. 로컬에서는 STOP_BEFORE_DM 또는 대상자 0으로 검증 안전 격리. |
| R5 | onSchedule 실발화 (Cloud Scheduler 4h 주기 배포·실행) | 사용자 | ⏸️ 이월(Phase 1.10) | 프로덕션 배포·Cloud Scheduler 프로비저닝 필요 → 범위 밖 |

#### R2 추가 검증: diff 3 케이스 (모두 PASS, 실 DM 0건)

DUMMY 크롤은 항상 동일한 9건 공고 반환 → **Redis 기준선 조작으로 각 케이스 강제**:

**케이스 1: added (추가)**
- 기준선(`recruit:hash:city:all`)에서 HDEL로 id 2건 제거 → 필드 7 → 9개 크롤 대비 2개 신규
- diff 결과: `{ added: 2, ... }`
- 이벤트 발행: ✅ `RECRUIT_CHANGED` 발행 확인 (Work completed 143ms). 알림 핸들러 진입했으나 구독자 지역 미매칭 → `NOTIFICATION_SEND` 미발행, 실 DM 0

**케이스 2: updated (변경)**
- 기준선에서 id 1건 해시값 변조 (예: score 변경)
- 같은 id, 다른 hash 비교
- diff 결과: `{ updated: 1, ... }`
- 이벤트 발행: ✅ `RECRUIT_CHANGED` 발행 확인 (Work completed 140ms). 알림 핸들러 진입했으나 구독자 지역 미매칭 → `NOTIFICATION_SEND` 미발행, 실 DM 0

**케이스 3: deleted (삭제)**
- 유령 id 999 주입 후 크롤→diff: 유령 공고 9건 크롤에 없음 → `deletedIds: [999]`
- diff 결과: `{ deleted: 1, ... }`
- **이벤트 발행 미진입** ✅ (설계 의도: `notificationService.targetJobs = added+updated` → deleted 제외)
- 발송 루프 미진입 → 실 DM 0 (설계대로)
- 각 실행 후 기준선 자가 복원(수정분 재저장/HDEL 반영 확인) ✅

#### 검증 방법론 (요약)
- **실 DM 부작용 차단**: 임시 env 게이트 (`STOP_BEFORE_DM`)를 `notificationService.ts`에 삽입 후 로컬 검증 완료 시 원복(working tree diff 없음) + rebuild. 프로덕션 코드에 미포함.
- **활성 구독자 필터링**: 1명 구독자 존재하나 SELECTED 모드·지역 필터에서 DUMMY 더미(지역코드 미매칭) → 발송 루프 미진입 (DM 0의 이중 안전장치)

### 4.3 문서화
- [x] JSDoc 주석 확인 — `runOnce`/`crawlAndDiff`/`emitEventAndSettle`/`initFunctionProviders`/`acquireLock`/`releaseLock` 신규 public API 주석 완료
- [x] 관련 문서 업데이트 — design.md (상세 설계) / analysis.md (갭 분석) 완성

---

## 5. 피드백 반영 내역

실시간 review가 없었으므로 기록 없음. 사용자 피드백 수신 시 아래 템플릿으로 반영:

<!-- ### [Revision 1] {{date}} - {{제목}}
**피드백 내용**:
**수정 계획**:
**승인 상태**: 대기 중 / 승인됨
**수정 결과**: -->

---

## 6. Process Improvement

### 6.1 잘된 점
- **설계 게이트 명확화**: plan의 리스크 R1(`§1 런타임 결정 강결합`)을 do 진입 전 design §1에서 고정·승인으로 진행 순서 탁명화 — 후속 #2~#5가 명확한 구현 경로를 따름
- **계약 중심 설계**: `DmPayload`/`DmSendResult`/`getRecruitList` 3-tier 계약 불변을 설계서에 명시 → 구현 범위 슈링크 가능
- **로컬 검증 방식 (1.9 재사용)**: DUMMY 크롤 + 기준선 조작 + env 게이팅으로 실 DM·CRAWL 미활성화 상태에서도 **파이프라인 정상 작동 확인** — 프로덕션 배포 전 confidence 향상
- **단일 tick 분리 (테스트 용이)**: `runOnce()` 추출로 로컬 unit test / `onSchedule` wrap / 로컬 DUMMY E2E 세 경로가 동일 로직 검증 가능
- **갭 분석 카테고리화**: Structural/Functional/Contract 3축 분류로 매치율 산출의 의미 명확화 — 각 축이 아키텍처·기능·외부 인터페이스에 대응

### 6.2 개선할 점
- **락 TTL 실측 이월**: 설계에서 "60s 고정"으로 가정했으나, 실제 구독자 다수/느린 크롤 시 `emitEventAndSettle` 대기 시간 미측정 → 1.10 E2E에서 락 범위 축소/TTL 재산정 필요. 구독자별 DM 순차 await 블로킹 비용도 동시 실측 권장 (report 이슈 #1)
- **공용 emit 헬퍼 로직 중복**: `emitRecruitChangedEvent` 내부 `.then(CHANGED && emit).catch(warn)` 래핑이 `getRecruitList` 두 백업 호출부에서 복제 → private 헬퍼 추상화 추천 (분석 #4 Info)
- **로컬 실행 모드 진입점 비명확**: `RUN_SCHEDULER_ONCE=true` env 게이팅은 gateway/함수 프로세스 부트스트랩을 다시 읽어야 이해 가능 → 주석/로그 강화 또는 진입점 파일 최상단에 "로컬 모드" 콕콕 명기 권장
- **Firestore 트리거 계약 미배선**: §1.1 "DB-as-bus" 방침만 명시되고 실제 Firestore 컬렉션 설계/리스너 코드는 Phase 2.1/2.2 이월 — 앞으로의 크로스-프로세스 확장 시 이 설계 명시사항을 재확인 필수 (design §1.1 링크 강화 권장)
- **코드 정리 미완료**: 이슈 #5(데드코드 `initializeSchedulers`) / #8(import 정렬) 미반영 → 다음 iterate/커밋에서 housekeeping 일괄 처리 권장 (분석 Info 7건)

### 6.3 다음 Phase 제안

| 제안 | 관련 Phase | 우선순위 |
|------|-----------|---------|
| onSchedule 실발화·REST DM 실전송·프로덕션 E2E | 1.10 | ⭐⭐⭐ (P0) |
| 실 CRAWL 활성화 (`recruitMode: CRAWL`), 실배포 gateway (Cloud Run) | 1.10 | ⭐⭐⭐ (P0) |
| `crawlService.ts:28` DUMMY 버그(#6) 수정·테스트 | 1.10 | ⭐⭐ (P1) |
| Firestore 크로스-프로세스 트리거 실배선 (에러 로그 발행 등) | 2.1/2.2 | ⭐⭐ (P1) |
| 락 범위 최적화/TTL 동적 재산정 (1.10 E2E 실측 후) | iterate | ⭐ (P2) |
| 공용 emit 헬퍼 중복 제거·코드 정리 (housekeeping) | iterate | ⭐ (P2) |

---

## 7. 다음 단계

1. [ ] 사용자 피드백 확인 및 승인 (본 report 검토)
2. [ ] `/pdca archive 1.13` 실행 (문서 → `docs/archive/phase-1-13/` 이동)
3. [ ] `/pdca cleanup` 실행 (pdca-status.json 히스토리 정리 + pdca-memory.json 초기화)
4. [ ] Git 커밋(논리 단위) + push + PR 생성 (base dev)
   - `feat(phase-1-13): 프로덕션 런타임 & 스케줄러 트리거 재설계` (기능 코드)
   - `chore: archive phase-1-13 + pdca bookkeeping` (문서·상태 이동)
5. [ ] PR 머지 → dev 동기화 → `/pdca next`

### 🔍 최종 검증 요약
- **매치율**: 100.0% (Structural 13/13 + Functional 10/10 + Contract 8/8)
- **Critical 이슈**: 0건
- **정적 통과**: ✅ TypeScript `exit 0`
- **로컬 DUMMY E2E**: ✅ 5개 항목 중 Claude 담당 3개(R1~R3) PASS, 사용자 담당 2개(R4·R5) Phase 1.10 이월
- **범위 명시**: 코드 + 정적/로컬 검증 한정 (실배포·실 CRAWL·프로덕션 E2E → Phase 1.10)

---

*작성일: 2026-08-07*
*참고: docs/phase-1-13/{01-plan.md, 02-design.md, 03-analysis.md}*

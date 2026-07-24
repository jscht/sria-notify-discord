# Phase 1.9: 알림 파이프라인 startup wiring + 로컬 E2E

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.1~1.8 (모두 완료/archived)

---

## 개요

### 배경

Phase 1.1~1.8을 거치며 이벤트 기반 알림 파이프라인의 모든 조각(EventBus, 스케줄러, RECRUIT_NEW 발행원, 구독자 필터, DM 전송기, 핸들러)은 구현 완료됐다. 그러나 1.7·1.8이 **startup wiring을 1.9에 위임**한 결과 다음 고리가 끊겨 있다:

- `registerAllEventHandlers()`가 정의·export만 되고 **production startup에서 호출되지 않음**(`events/bus/utils/registerEventHandlers.ts:37`) → EventBus가 리스너 0개로 부팅 → `RECRUIT_NEW`가 발행돼도 구독자 없음. **(핵심 끊긴 고리 1개)**
- `initializeSchedulers()` 호출이 주석 처리되어 스케줄러가 꺼져 있음(`common/middlewares/initializeWorker.ts:12-15`).
- `initDiscordBot()`이 `client.login()`을 await하지 않음(fire-and-forget) → 첫 사이클이 client ready 전 DM을 시도하면 유실 가능.

**구조적 사실 → Phase 분리:** 배포 타깃이 `onRequest` cold-start Cloud Functions(`firebaseDeploy.ts`, `minInstances` 주석)라서 `BaseScheduler`의 in-process `setTimeout` 스케줄러는 **프로덕션에서 동작하지 않는다**(응답 후 CPU 동결). 봇도 gateway WebSocket(`client.ts`) 의존이라 dmSender(`client.users.fetch`)가 서버리스 틱과 궁합이 나쁘다. 이 **프로덕션 런타임 + 스케줄러 재설계**는 1.10·2.1·2.2가 공유하는 인프라이므로 **Phase 1.13으로 분리**한다.

### 목표

이미 완성된 파이프라인을 startup에서 연결하고, **로컬 emulator(상주 프로세스)** 에서 크롤 → 신규 감지 → 구독자 알림 → 실제 DM E2E를 처음으로 완성한다. (DM E2E 병목 해소)

### 범위

| 포함 (1.9 — 로컬) | 제외 (→ 다른 Phase) |
|------|------|
| `registerAllEventHandlers()` startup 호출 연결 | `onSchedule`(Cloud Scheduler) 트리거 → 1.13 |
| RecruitScheduler 로컬 활성화(DUMMY) + graceful shutdown | dmSender REST 전용 전환 → 1.13 |
| `initDiscordBot` await login+ready (HTTP 비결합) | 틱 완결 파이프라인 / 프로덕션 E2E → 1.13 |
| dmSender 발송 직전 ready 게이트(C안 — `await getDiscordReady()`) | (없음) |
| `SARIAN_*` → `DISCORD_*` env rename (코드 3곳 + .env 4키) | 실 CRAWL 전환·재배포 → 1.13 |
| 로컬 emulator DUMMY 알림 E2E (실 DM 1건 수신) | ProxyScheduler 활성화·저장 → 1.10 |

---

## 요구사항

### 기능 요구사항

1. **핸들러 등록 연결**: `app/index.ts` eager 블록에서 `registerAllEventHandlers()`를 1회 호출하여 EventBus 리스너를 등록한다.
2. **스케줄러 로컬 활성화**: `initializeSchedulers({ recruitMode: CRAWL_MODE.DUMMY })`로 RecruitScheduler만 시작하고, `setupGracefulShutdown(manager)`로 SIGINT/SIGTERM 처리.
3. **Discord ready 게이트**: `initDiscordBot`을 `async`로 전환하여 `client.login()` + `ClientReady`까지 대기. 단 ready 실패가 HTTP 가용성을 막지 않도록 격리. **게이트 위치는 dmSender 발송 직전**(`sendNotificationDM`에서 `await getDiscordReady()`)이며, 스케줄러 시작은 막지 않는다(C안).
4. **env 표준화**: `SARIAN_*`(코드 3곳 + .env 4키)을 `DISCORD_*`로 전면 rename.

### 비기능 요구사항

- **성능**: 핸들러 등록·스케줄러 시작은 부팅 1회. 멱등 가드(`handlersRegistered`, `initPromise`)로 cold start 중복 방지.
- **호환성**: 기존 provider init·Express 부팅 흐름 유지. Discord 실패가 HTTP 요청을 마비시키지 않음(현행 동작 보존).
- **에러 처리**: eager init 실패는 로그만, SystemError 패턴 준수.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js 14.17 (gateway) |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식

신규 비즈니스 로직 없이 **연결만** 한다. `app/index.ts` eager init 블록에서 순서를 보장:

```
initializeProviders()                 // Discord ready 포함해 await
  .then(() => {
     registerAllEventHandlers();       // 리스너 등록 (멱등)
     const mgr = initializeSchedulers({ recruitMode: CRAWL_MODE.DUMMY, enableProxy: false }); // 로컬, Proxy off→1.10
     setupGracefulShutdown(mgr);
  })
  .catch(...)                          // 실패는 로그만 (HTTP 비결합 유지)
```

> 재사용: `registerAllEventHandlers`(`events/bus/utils/registerEventHandlers.ts:37`), `initializeSchedulers`/`setupGracefulShutdown`(`crawlers/index.ts`), `CRAWL_MODE`(`common/constants`).

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `functions/src/app/index.ts` | 수정 | eager 블록에 핸들러 등록 + `initializeSchedulers({recruitMode:DUMMY, enableProxy:false})` + graceful shutdown 연결 |
| `functions/src/providers/discord/initDiscordBot.ts` | 수정 | `async` 전환 → `await client.login(...)` + `client.once(Events.ClientReady)`. 토큰 `DISCORD_BOT_TOKEN` |
| `functions/src/providers/discord/register-commands.ts` | 수정 | `DISCORD_BOT_TOKEN`/`DISCORD_APP_ID`/`DISCORD_TEST_GUILD_ID` |
| `functions/src/crawlers/schedulers/utils/initializeSchedulers.ts` | 수정 (plan 누락분 — 신규 추가) | `SchedulerInitConfig`에 `enableProxy?: boolean`(기본 `true`, 하위호환) 추가 → false면 `startProxyScheduler` 게이팅. 1.9는 `enableProxy:false`로 Recruit만 시작 (Proxy→1.10) |
| `functions/.env` | 수정 | `SARIAN_*` 4키 → `DISCORD_*` |
| `functions/src/common/middlewares/initializeWorker.ts` | 수정(주석) | 12~15줄 정리 — 스케줄러 init이 `app/index.ts`로 확정 반영 |

### 의존성 분석

- **의존 모듈(기존)**: EventBus 싱글톤, NotificationEventHandler(1.7), NotificationSendHandler(1.8), SchedulerManager, RecruitService, SubscriptionStore.
- **후속 Phase**: 본 Phase의 startup 연결 위에 **Phase 1.13**(프로덕션 런타임/스케줄러 재설계)이 올라가며, 1.10·2.1·2.2가 1.13에 의존.

### 주의사항

1. **DUMMY 발행 전제 (정정 2026-06-25)**: `setRecruitList`는 빈 캐시 → `NO_DATA`로 baseline만 저장, **RECRUIT_NEW 미발행**. 발행은 기존 baseline 대비 diff(`CHANGED`)에서만. 따라서 E2E는 ① 1차 크롤로 baseline 적재 → ② `recruit:hash:city:all` 해시 일부 필드만 `HDEL`(전체 삭제 금지) → ③ 2차 크롤로 added 감지 → 발행. (실제 키는 `recruit:hash:city:all`/`recruit:city:all`, literal `recruit_hash` 아님)
2. **ready 게이트 HTTP 비결합** (CTO 확정 방향): `initializeProviders()`는 `Promise.all([initFirebaseApp, initRedis, initDiscordBot])`를 `initPromise`로 memoize하고 `initializeWorker`가 매 요청 await한다. `initDiscordBot`을 async화해 그 reject를 `Promise.all`에 전파하면 모든 HTTP 마비. → ready 대기/실패를 `Promise.all` 체인 바깥의 별도 promise(`discordReady` 등)로 분리해 격리(provider init 체인은 reject 안 함 — 항상 resolve). **C안: 스케줄러는 즉시 시작(게이트 X), ready 대기는 dmSender 발송 직전 `await getDiscordReady()`에서만 한다.** ClientReady 전 `client.users.fetch()`는 graceful skip이 못 막고 max_retries 실패로 DM 유실되므로, 발송 직전 게이트로 race를 해소한다(design §2.7).
3. **첫 사이클 즉시 실행**: `startWork()`→`scheduleNextWork()`가 지연 없이 1회 크롤 → 부팅 직후 자동 E2E.
4. **env 표기 메모**: 문서(CLAUDE.md)는 app id를 `DISCORD_CLIENT_ID`로 기재 — 본 rename은 기계적 `APP_ID` 유지, 문서 정합화는 후순위.
5. **스케줄러 부팅 멱등 (design 검증 필요)**: `startRecruitScheduler()`는 인스턴스는 재사용하지만 호출마다 `startWork()`를 다시 부른다. eager 블록이 프로세스당 1회 실행이라 정상 경로엔 문제없으나, cold-start 재진입·중복 init 시 이중 `startWork`(타이머 중복) 가능성을 design이 가드(이미 실행 중이면 skip)로 확정할 것.

---

## 성공 기준

- [ ] startup 시 `registerAllEventHandlers()` 호출 → EventBus 리스너 수 > 0 (로그)
- [ ] RecruitScheduler DUMMY 등록·시작 ("✅ All schedulers initialized")
- [ ] `initDiscordBot` login+ready await, 단 Discord 실패가 HTTP를 막지 않음
- [ ] `SARIAN_*` 잔여 참조 0 (grep), `DISCORD_*`로 부팅 성공
- [ ] TypeScript 컴파일 성공 (`npx tsc --noEmit`)
- [ ] (로컬 E2E) DUMMY 크롤 → RECRUIT_NEW → 구독자 알림 → 실제 DM 1건 수신 → NOTIFICATION_SENT 로그
- [ ] dmSender가 발송 직전 `getDiscordReady()` 대기 → ready 전 첫 크롤이어도 DM 정상 발송(race 해소, max_retries 실패 없음)

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| ready 게이트가 HTTP 가용성과 결합 | 높음 | Discord ready를 `Promise.all` 바깥으로 격리, provider init reject 비전파. ready 대기는 dmSender 발송 직전 게이트(C안)에서만 (주의 §2) |
| ready race로 첫 크롤 DM 유실 (ClientReady 전 fetch) | 높음 | dmSender 발송 직전 `await getDiscordReady()` 1회 — 실질 지연 0, login 실패 시 resolve로 무한 대기 없음 (design §2.7) |
| DUMMY 첫 크롤이 RECRUIT_NEW 미발행 (NO_DATA baseline) | 중간 | baseline 적재 후 `recruit:hash:city:all` 해시 일부만 `HDEL` → 2차 크롤로 added 감지 (주의 §1) |
| env rename 누락으로 login 실패 | 중간 | grep으로 `SARIAN_*` 잔여 0 검증 + 부팅 로그 확인 |
| in-process 스케줄러 프로덕션 미동작 | (범위 외) | Phase 1.13으로 분리 — 1.9는 로컬 한정 |

---

## 위임 계획 (CTO Lead 게이트 — 승인된 계획서 반영)

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|-----------|------|-------------|
| startup wiring + 부팅 순서 + 스케줄러 init(+`enableProxy` 게이팅) | **Integration Lead** | 부트스트랩/오케스트레이션. UI 아님 | `app/index.ts`, `initializeSchedulers.ts` |
| Discord ready 게이트 + env rename | Integration Lead | provider 부트스트랩 | `initDiscordBot.ts`, `register-commands.ts`, `.env` |
| design.md 작성 → 품질 게이트 | Integration Lead → **Design Validator** | PDCA design 표준 | `docs/phase-1-9/02-design.md` |

> CTO Lead 확정(design 게이트): ready 게이트 본질이 discord.js API가 아니라 `initializeProviders()`의 `Promise.all` 강결합 문제 → Integration Lead 단독(Discord Agent 협업 불필요).

---

## 후속 bookkeeping (cleanup 단계 반영)

**Phase 1.13 "프로덕션 런타임 & 스케줄러 트리거 재설계" 신설** — `pdca-status.json` priority/dependencies/tasks 추가, 1.10·2.1·2.2 dependency에 1.13 추가, `phase-1-core.md` 시드 섹션 추가.

---

*작성일: 2026-06-11*
*시드: .claude/phases/phase-1-core.md*

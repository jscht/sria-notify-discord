# Phase 1.9 갭 분석: 알림 파이프라인 startup wiring + 로컬 E2E

**상태**: 🔍 검토 중
**분석일**: 2026-06-25 (정적 범위 재분석 — 직전 런타임 오계상 정정)
**범위**: 정적 분석 (코드↔설계 일치). 런타임 E2E(§6.2)는 매치율 제외 — `review-process.md` 0단계 대상.
**설계서**: `docs/phase-1-9/02-design.md`

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1/§4.1 신규 leaf `discordReady.ts` (의존 0, ready promise + `getDiscordReady`/`markDiscordReady`) | 신규 파일 존재, import 0 (discord.js·events·client 미import) | ✅ Y | `providers/discord/discordReady.ts` |
| S2 | §1.1/§4.2 신규 `discordListeners.ts` — `events` 배열 이관, `registerAllEventHandlers` 미포함 | 배열 onReady/onPingPongCreate/onInteraction만 | ✅ Y | `events/discordListeners.ts` |
| S3 | §1.1/§4.2 `events/index.ts` — `events`를 재노출로 전환(외부 API 불변) | `export { events } from "./discordListeners"` + 기존 export 유지 | ✅ Y | `events/index.ts` |
| S4 | §2.1 `initDiscordBot` async + `events`를 좁은 모듈에서 import + `markDiscordReady` import | `async`, `@/events/discordListeners`·`markDiscordReady` import | ✅ Y | `providers/discord/initDiscordBot.ts` |
| S5 | §2.7 `dmSender`가 leaf `discordReady`에서 `getDiscordReady` import (initDiscordBot 미import) | leaf import, initDiscordBot 참조 0건 | ✅ Y | `providers/discord/utils/dmSender.ts` |
| S6 | §2.3 `SchedulerInitConfig`에 `enableProxy?: boolean` 필드 추가 | optional 필드 추가됨 | ✅ Y | `crawlers/schedulers/utils/initializeSchedulers.ts` |
| S7 | §2.1 `providers/index.ts` 무변경(★ HTTP 비결합 핵심) | `Promise.all([...initDiscordBot()])` 그대로 | ✅ Y | `providers/index.ts` |
| S8 | §2.4 `BaseScheduler`/`SchedulerManager` 무변경(멱등 가드 기존재) | 본 Phase 산출물에 미포함 | ✅ Y | `crawlers/schedulers/base/BaseScheduler.ts` (미변경) |

**Structural: 8/8 완전일치**

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.1 `initDiscordBot`이 login 실패를 throw하지 않고 **항상 resolve**(HTTP 비결합) | try/catch + catch에서 로그+`markDiscordReady()`, throw 없음 | ✅ Y | `initDiscordBot.ts:28-35` |
| F2 | §2.1 ready 빗장: `Events.ClientReady` once → `markDiscordReady()` + 실패 catch에서도 호출(무한대기 방지) | 둘 다 존재 | ✅ Y | `initDiscordBot.ts:24-26,34` |
| F3 | §2.1 leaf 빗장 일방향(promise 1회 resolve, 이후 즉시 통과) | `new Promise(r=>resolveReady=r)` + `markDiscordReady`=resolveReady() | ✅ Y | `discordReady.ts:17-32` |
| F4 | §2.2 `app/index.ts` `.then(register → scheduler({enableProxy:false}) → shutdown).catch(log)` | 3개 호출 순서대로 + `.catch(globalLogger.error)` | ✅ Y | `app/index.ts:24-35` |
| F5 | §2.2 Express 부팅이 eager 체인과 독립(체인 실패가 export 안 막음) | `initExpress→firebaseDeploy→export default` 독립 실행 | ✅ Y | `app/index.ts:37-52` |
| F6 | §2.3 `enableProxy !== false`일 때만 Proxy 시작, false면 skip 로그. Recruit는 무조건 | `if (config?.enableProxy ?? true)` + else skip 로그 | ✅ Y | `initializeSchedulers.ts:34-40` |
| F7 | §2.7 dmSender가 `while` 루프 **진입 전 1회** `await getDiscordReady()` | `while` 위 117번 줄 1회 위치 | ✅ Y | `dmSender.ts:117-119` |
| F8 | §2.6 `initializeWorker` 주석 정리, 로직 무변경 | 주석 갱신, `await initializeProviders()`만 | ✅ Y | `initializeWorker.ts:12-13` |
| F9 | §2.2/§1.2 스케줄러를 ready로 막지 않음(즉시 시작), 게이트는 dmSender 발송 직전에만 | `.then`에서 ready 미대기, dmSender에만 게이트 | ✅ Y | `app/index.ts:25-31`, `dmSender.ts:117` |

**Functional: 9/9 완전일치**

> 부팅 wiring의 실제 동작(핸들러 2개 등록, ready, RecruitScheduler 시작, Proxy skip, DUMMY 크롤)은 정적 코드 구조로 모두 존재 확인 — F dimension 일치 근거. 실 발화·실 DM은 §3.3(런타임)로 분리.

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | §2.1 `getDiscordReady(): Promise<void>` / `markDiscordReady(): void` + JSDoc | 정확히 일치, JSDoc 존재 | ✅ Y | `discordReady.ts:24-32` |
| C2 | §2.1 `initDiscordBot(): Promise<void>` (async, 항상 resolve) | `export async function initDiscordBot(): Promise<void>` + JSDoc | ✅ Y | `initDiscordBot.ts:14` |
| C3 | §2.5 env rename `process.env.DISCORD_BOT_TOKEN` (initDiscordBot) | `client.login(process.env.DISCORD_BOT_TOKEN)` | ✅ Y | `initDiscordBot.ts:29` |
| C4 | §2.5 env rename 3키 (register-commands) | `DISCORD_BOT_TOKEN`/`DISCORD_APP_ID`/`DISCORD_TEST_GUILD_ID` 치환 | ✅ Y | `register-commands.ts:13,20` |
| C5 | §6.1 `functions/src`에 `SARIAN_` 잔여 0건 | grep 0건 | ✅ Y | `functions/src/**` |
| C6 | §2.3 `enableProxy?` optional, 미지정 시 시작(하위호환) | `?? true` 기본값 | ✅ Y | `initializeSchedulers.ts:16,34` |
| C7 | §6.1 import 순환 부재(R3): dmSender↛initDiscordBot + 좁은 모듈 import + register 미포함 | 3조건 충족, tsc exit 0 | ✅ Y | `dmSender.ts`/`initDiscordBot.ts`/`discordListeners.ts` |
| C8 | §2.1/§2.7 게이트 reject 불가(`getDiscordReady` resolve 전용 → 신규 try/catch 불필요) | leaf promise resolve만, dmSender에 ready용 try/catch 미추가 | ✅ Y | `discordReady.ts:20-22`, `dmSender.ts:117` |
| C9 | §1.1 DmSendResult/DmPayload 계약(1.8 공유) 무회귀 | 시그니처·분류 로직 1.8 그대로(게이트 1줄만 추가) | ✅ Y | `dmSender.ts:12-37,108-202` |
| C10 | §6.1 `process.env.DISCORD_` 부팅 참조 존재 | 3키 코드 참조 확인 | ✅ Y | `initDiscordBot.ts`, `register-commands.ts` |

**Contract: 10/10 완전일치**

> 메모(갭 아님): §2.5 `DISCORD_PUBLIC_KEY`는 "코드 미참조 — .env만 rename"으로 설계 명시, src 참조 0건이라 정합. `.env`는 미열람(실 secret), 정적 사실(DISCORD_ 4 / SARIAN_ 0 count-only)만 인정.

---

## 2. 매치율 산출 (정적 범위)

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 8/8 | 100% |
| Functional (×0.4) | 9/9 | 100% |
| Contract (×0.4) | 10/10 | 100% |
| **종합 매치율** | 27/27 | **100%** |

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
            = 100×0.2 + 100×0.4 + 100×0.4 = 100%
```

> **재분석 사유**: 직전 분석이 런타임 E2E 결과(RECRUIT_NEW 실 발화·실 DM·ready race)를 매치율에 잘못 포함시켜 82.5%로 계상했다. analyze는 정적(코드↔설계)이고 런타임 E2E는 §6.2 = 0단계(사용자 실행)이므로 분리하면 정적 27항목 기준 100%다.

---

## 3. 갭 목록

### 3.1 미구현 항목 (정적)

| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| — | — | — | **없음** — 정적 설계 구현 갭 0건 | — |

### 3.2 설계 차이 (허용 판정)

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| D1 | §2.3 로그 문구 `"ProxyScheduler skipped"` / `"Schedulers initialized"` | `"Proxy scheduler skipped (enableProxy=false)"` / `"All schedulers initialized"` | 허용 (문구 사소 차, 동작 동일) |
| D2 | §2.3 pseudo `config?.enableProxy !== false` | 구현 `config?.enableProxy ?? true` | 허용 (논리 동치) |
| D3 | §2.1 pseudo `client.login` 직후 주석 | 구현 주석이 더 상세(빗장·fetch 실패 인과) | 허용 (의도 강화) |

> D1~D3은 동작·계약 무영향 표현 차이로 감점 없음(설계가 "pseudo"·"문구 예시"로 명시한 비-계약 항목).

### 3.3 ★ 0단계 런타임 검증 대상 (매치율 제외 — review-process.md 0단계)

설계서 §6.2("★ 사용자 수동 — 봇 실행 필요") 항목. 봇 실행 없이는 정적 판정 불가 → **매치율 제외**. analyze 통과 후 사용자가 선택적으로 수행(실패 시 갭 등재 → iterate).

| # | §6.2 항목 | 검증 내용 | 정적 근거(코드 존재) | 런타임 확인 필요 |
|---|----------|----------|---------------------|----------------|
| R1 | §6.2-#5 RECRUIT_NEW 발행 | 2차 크롤(부분 해시 HDEL 후) `CHANGED` → 실 발행 | 발행 경로·핸들러 등록 정적 존재 | 실 발화 |
| R2 | §6.2-#6 구독자 알림 → 실제 DM | 대상 사용자 DM 1건 실수신 | dmSender 발송 직전 게이트(F7) 존재 | 실 DM 수신 |
| R3 | §6.2-#7 NOTIFICATION_SENT | `ok:true` / max_retries 실패 없음 | 결과 분기 로직(C9) 존재 | 실 전송 결과 |
| R4 | §6.2-#8 ready race 해소 | 첫 크롤이 ready보다 빨라도 DM 유실 없음 | `await getDiscordReady()`(F7) 존재 | 실 타이밍 |
| R5 | §6.2-#3/#4/#9 ready 로그 / HTTP 비결합 음성검증 / graceful shutdown | 부팅 로그·Ctrl+C 동작 | 빗장·shutdown wiring(F2/F4) 존재 | 실 실행 로그 |

> **직전 분석 정정**: 직전 F7/F8(런타임 발화·DM·race)을 본 §3.3 R1~R4로 이관(매치율 제외). 직전 §6.2/§3.2 트리거 절차 문서 결함은 설계서 2026-06-25 정정(§3.2 발행시점 = "baseline 대비 CHANGED만, 빈 캐시 NO_DATA 미발행", §6.2 전제 = "baseline 적재 → `recruit:hash:city:all` 일부 HDEL → 2차 크롤")을 코드와 대조해 **해소 확인**. `recruitCacheService.ts`는 1.9 미수정 + 시맨틱 정상 — 코드 갭 아님.

### 3.4 ★ 0단계 런타임 검증 실행 결과 + 임베드 UX iterate 갭 (2026-07-24)

**0단계 실행 결과** (사용자 실행 / Claude가 `node` 드라이버로 실 DM 발송):

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| R1 | RECRUIT_NEW 실 발화 | ✅ PASS | 직전 세션 E2E(`run-A.log`) `CHANGED added:2` → RECRUIT_NEW 발행 |
| R2 | 구독자 알림 → 실제 DM | ✅ PASS | 대상(본인 테스트 ID) DM 실수신, `ok:true, attempts:1` |
| R3 | NOTIFICATION_SENT / max_retries 없음 | ✅ PASS | dmSender `ok:true` 반복 확인 |
| — | dmSender 10013 Unknown User 실패분기 | ✅ PASS | `{ ok:false, reason:"unknown_user", errorCode:10013, attempts:1 }` + `providerLogger.error` (재시도 없음) |
| R4 | ready race 해소 (실 타이밍 재현) | ⏸ 이월 | Phase 1.13 프로덕션 E2E 검증 리스트로 이월 |
| R5 | ready 로그 / HTTP 비결합 음성검증 / graceful shutdown | ⏸ 이월 | Phase 1.13 이월 |
| — | DM 50007 skip / rate limit(429) / 부하·스트레스 | ⏸ 이월 | Phase 1.13 이월 |

**임베드 UX iterate 갭** (R2 렌더 검증 중 모바일에서 발견 → 02-design §7로 스펙화 → `/pdca iterate` 구현):

| # | 갭 내용 | 개선 (§7) | 우선순위 |
|---|--------|-----------|---------|
| G1 | 푸시 배너에 요약 텍스트 없음(임베드 제목만) | content 2줄 요약(배너 개행 유지) | ⭐⭐ |
| G2 | 임베드 상단 빈 줄(제로폭 필드 name) | description 단일 문자열로 전환 | ⭐⭐ |
| G3 | 오버플로 임계 `>=6` + "새로운" 부정확 문구 | 임계 `>3`, 중립 문구·`▸`·전체 공고 링크 | ⭐⭐ |
| G4 | 지역/모드(settings) 미반영 | SELECTED 지역 라벨·footer, ALL 분기 | ⭐⭐ |
| G5 | 오버플로 아이콘 `➕` 컬러(검게 보임) | 모노크롬 `▸`/`▽` | ⭐ |

> R4/R5·DM 에러분기(50007/429)·부하 항목은 **로컬에서 재현 불가/프로덕션 성격**이라 Phase 1.13 프로덕션 E2E 검증 리스트로 이월(설계 `phase-1-core.md` Phase 1.13). 1.9 iterate 범위는 위 G1~G5(임베드 UX)로 한정.

### 3.5 iterate 재분석 — 임베드 §7 구현 갭 대조 (2026-07-24, iterate #1)

02-design §7 스펙 대비 구현(`notificationMessageEmbed.ts`, `NotificationSendHandler.ts`) 대조. Discord Agent 구현 후 `npx tsc --noEmit` exit 0 + 실 lib 함수로 DM 발송(SELECTED/ALL) 렌더 확인.

| # | 차원 | §7 설계 항목 | 구현 | 일치 |
|---|------|-------------|------|------|
| E1 | Structural | `notificationMessageEmbed(jobs, settings)` 시그니처 확장 | `settings: AlarmSubscription` 인자 추가 | ✅ |
| E2 | Structural | 배너 빌더 `notificationBannerContent(jobs, settings)` 신규 export | 추가됨 | ✅ |
| E3 | Structural | `OVERFLOW_THRESHOLD`(6) 제거, 임계 `> TOP_COUNT` 통일 | 상수 제거, `jobs.length > TOP_COUNT` | ✅ |
| E4 | Functional | content 2줄(`📢 {label} · 총 N건` / `⎵▽ 안내`) | 일치 (실측 `📢 서울·부산·대전 · 총 8건`) | ✅ |
| E5 | Functional | `regionLabel`: SELECTED=CITIES "·" 조인 / ALL="전체 지역" | 일치 (ALL 분기 실측) | ✅ |
| E6 | Functional | embed 헤더 없음(color+timestamp만) | title/description 미설정 | ✅ |
| E7 | Functional | description 상위 3건 블록(제목링크/📅날짜/⏳·🏷️), `\n\n` join | 일치 | ✅ |
| E8 | Functional | `trimDate` 시간 제거 | `~` split + 첫 토큰 | ✅ |
| E9 | Functional | 오버플로 `▸ … · [전체 공고 …](baseUrl)`, baseUrl 없으면 텍스트만 | 분기 구현 | ✅ |
| E10 | Functional | SELECTED+오버플로만 안내문 2줄(footer 아님, description 하단) / ALL·무오버플로 생략 | `blocks.push` + `alertMode==SELECTED && hasOverflow` (footer 미사용 — 개행 위해 description) | ✅ |
| E11 | Contract | 핸들러: `notificationMessageEmbed(jobs, settings)` + `content` 생성 → `sendNotificationDM({content, embeds})`, `jobs.length===0` early return 유지 | 일치 | ✅ |

**임베드 §7 매치: 11/11 (100%)** — 갭 G1~G5 전부 종료.

**코드 품질** (inline): `console.*` 0(순수 함수), provider→services/features import 0, `regionLabel`/`trimDate` 내부 헬퍼 분리 + `formatJobTitleLink` 재사용(DRY), JSDoc·한국어 주석 유지, TypeScript strict(tsc exit 0). 🔴 Critical 0 / 🟡 Major 0. (참고: `recruitMessageEmbed`와의 블록 DRY는 1.8 이월 W1 — 본 iterate 범위 외.)

**종합**: 정적 매치율 유지 **100%**, 임베드 §7 갭 0건. → report 진행 가능.

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟢 Minor | 컨벤션 | `dmSender.ts` 로그 다수 | 운영 로그 한/영 혼용(정책 허용, 파일 내 일관성만 약함) | 한 언어 통일(권장 한글). 강제 아님 |
| 2 | 🟢 Minor | 컨벤션 | `register-commands.ts`, `initializeSchedulers.ts` | 로그 이모지 — grep/파서 노이즈 | 선택 |
| 3 | 🟢 Minor | DRY | `dmSender.ts:125,133,152,194` | `const durationMs=Date.now()-startedAt` 4분기 반복 | `elapsed()` 클로저 추출 가능, 현행도 정당 |
| 4 | 🟢 Minor | 컨벤션 | `register-commands.ts:1` | import 순서(internal이 external 위) — 기존 이슈 | external→internal 정렬 |
| 5 | 🟢 Minor | 성능 | `dmSender.ts:122` | 재시도 루프 내 `users.fetch` 반복(캐시 흡수) | 영향 미미, 조치 불요 |

### 4.2 핵심 검증 항목 (모두 안전)

| 항목 | 판정 | 근거 |
|------|------|------|
| latch 초기화 순서 | ✅ 안전 | Promise executor 동기 실행 보장 → `resolveReady` 모듈 평가 시 할당 완료 |
| `.then/.catch` HTTP 비결합 | ✅ 유지 | catch가 throw 안 함, `globalLogger` 전역 선언+side-effect import로 참조 가능 |
| 이중 ClientReady 등록 | ✅ 무해 | onReady(로깅) vs initDiscordBot(latch) 책임 분리, 둘 다 once |
| env rename / enableProxy | ✅ 일관 | `SARIAN_`→`DISCORD_` 전량, `?? true` 하위호환 |
| 프리셋 로거 / LogSource | ✅ 준수 | console.* 0건, providerLogger/globalLogger |

### 4.3 컨벤션 준수

| 항목 | 상태 |
|------|------|
| SystemLogger/프리셋 로거 | ✅ |
| LogSource 제약 | ✅ |
| 네이밍 규칙 | ✅ |
| import 정리 | 🟡 (register-commands.ts 기존 이슈) |
| TypeScript strict | ✅ (tsc exit 0) |
| provider 계층 격리 | ✅ (discordReady 의존 0 leaf, R3 순환 차단) |
| JSDoc / 한국어 주석 | ✅ |

### 4.4 요약
- 🔴 Critical: **0건**
- 🟡 Major: **0건**
- 🟢 Minor: **5건** (모두 권장/참고 — 강제 수정 불요)

---

## 5. 다음 단계 분기

✅ **정적 매치율 100% (≥ 90%) AND 🔴 Critical 0건** → 정적 통과.
✅ **0단계 런타임 검증 실행됨(§3.4)** — R1~R3 + 10013 분기 PASS. R4/R5·DM 에러분기·부하는 Phase 1.13 이월.

진행 경로 (2026-07-24):
1. ✅ **iterate #1 완료** — §3.4 갭 G1~G5를 02-design §7 스펙대로 구현(Discord Agent). tsc exit 0 + 실 DM 렌더 확인.
2. ✅ **재-analyze 완료(§3.5)** — 임베드 §7 11/11 일치, 갭 0건, 매치율 100% 유지.
3. → **`/pdca report 1.9`** 진행 가능.

> ⚠️ Claude는 봇을 실행할 수 없으나, 본 0단계는 `node` 드라이버로 실 DM을 발송해 검증함(모바일 렌더 육안 확인은 사용자). R4/R5는 프로덕션 성격이라 1.13 이월.

---

*분석일: 2026-06-25 (정적 범위 재분석 — 직전 런타임 오계상 정정)*
*수정: 2026-07-24 — §3.4 0단계 실행 결과 + 임베드 UX iterate 갭(G1~G5) 등재.*
*수정: 2026-07-24 — §3.5 iterate #1 재분석(임베드 §7 11/11 일치, 갭 0건, 매치율 100% 유지).*
*참고: docs/phase-1-9/02-design.md, docs/phase-1-9/01-plan.md*

# Phase 1.10 갭 분석: mock 재정의 (최소 base + 사이트별 프로바이더·규칙엔진)

**상태**: 🔍 검토 중
**분석일**: 2026-09-23 (최초) · **재분석**: 2026-09-28 (iterate C-1 해소 후 — 매치율 95.2%→**99.3%**, 🔴 Critical 1→**0건**)
**설계서**: `docs/phase-1-10/02-design.md`
**범위**: 정적 코드 ↔ 설계 일치. 봇 상시기동·실 DM이 필요한 런타임 E2E(MC-U1/OP-U2)는 매치율 제외(런타임 결과는 `06-event-case-tests.md` 참조). 단, **배포 엔트리 wiring 결함은 봇 실행 없이 정적 판정 가능해 매치율 포함.**

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목(§) | 구현 상태 | 일치 | 파일 |
|---|-------------|----------|------|------|
| S1 | recruit.d.ts 재작성 + 구 RecruitData/ProviderRecruit 삭제(§1.1/§2.1) | 재작성 완료, Href→sria/href.ts 이전 | ✅ | `common/types/recruit.d.ts` |
| S2 | providers/recruit/** 신규 계층 + 레지스트리(§2.2) | RecruitProvider + lazy 레지스트리 | ✅ | `providers/recruit/{RecruitProvider,index}.ts` |
| S3 | sria/* 파일 세트(§2.3) | href·postings·config·generator·provider 5종 | ✅ | `providers/recruit/sria/*` |
| S4 | temp/* 파일 세트 + README(§2.4) | titles·fields·rule·config·provider·README | ✅ | `providers/recruit/temp/*` |
| S5 | 구 crawlers/·mock/·api/ 삭제(§4-9) | crawlers/ 전량 삭제, 활성 심볼 0 | ✅ | (삭제됨) |
| S6 | recruitSourceService 신규(§1.1) | fetchAll/fetchBySource/isRequestAllowed | ✅ | `services/recruitSourceService.ts` |
| S7 | schedulers 소스별 구조(§1.1) | RecruitScheduler(source)/runRecruitOnce | ✅ | `schedulers/**` |
| S8 | app/scheduler.ts 소스별 export 모듈(§2.5) | recruitSchedule_sria/_temp = onSchedule | ✅ | `app/scheduler.ts` |
| S9 | embeds jobLink.ts(§2.7) | formatJobTitleLink/recruitField | ✅ | `embeds/jobLink.ts` |
| S10 | redis 요청제한 스토어 명칭 통일(§2.8) | RequestLimitStore | ✅ | `providers/redis/store/*` |
| S11 | firebase recruit store Recruit[](§1.1) | Recruit[] + setLastRefreshedAt | ✅ | `providers/firebase/store/recruit.ts` |
| S12 | SourceStrategy common 이전(§2.8) | sourceStrategy.ts, SourceStrategyType | ✅ | `common/constants/sourceStrategy.ts` |
| **S13** | **소스별 스케줄이 실제 배포 엔트리에 연결(§2.5·§6)** | **E안(하이브리드)로 해소: `main=lib/app/scheduler.js`, 컴파일 산출에 `recruitSchedule_sria/_temp` onSchedule export 확인 → Functions 배포 시 스케줄러 발견** | ✅ (해소) | `package.json:19`, `lib/app/scheduler.js:5-6,25-32` |
| S14 | 참조 문서 source/sync 동기화(§2.8 파급) | 코드 통일 완료, 가이드 .md는 stale | ⚠️ 부분 | `SYSTEM_ERROR/LOGGER_GUIDE.md`, `*/CLAUDE.md` |
| S15 | 게이트웨이 상주 엔트리(E안 신규, 설계 미명세→iterate 보강) | `gateway.ts`(app.listen+/health) / `bootstrapGateway.ts`(공통 부트스트랩) / `initGatewayProviders`(WS)·`initFunctionProviders`(REST) 분리, 전부 컴파일됨 | ✅ | `app/{gateway,bootstrapGateway}.ts`, `app/express.ts:29`, `providers/index.ts:15,37` |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목(§) | 일치 |
|---|-------------|------|
| F1 | sria 스냅샷 생성기(규칙없음, id namespace, url=base+href) | ✅ |
| F2 | temp PRNG(FNV-1a+fmix32)·경계 t=floor(now/unitMs)·spawn 누적확률 | ✅ |
| F3 | temp 확정 수정(진행도 remaining→dDay/status 매 경계) | ✅ |
| F4 | temp 확률 수정(editProb 토글) | ✅ |
| F5 | temp 확정 삭제(t≥s+lifespan) | ✅ |
| F6 | temp 확률 삭제 영구성(firstDeathTick, born+1부터) | ✅ |
| F7 | temp spec 적용(required‖chance, fixed/pick) | ✅ |
| F8 | 소스별 diff 파티션(id.startsWith "{source}:") | ✅ |
| F9 | 소스별 sync + 락 lock:recruit:sync:{source} | ✅ |
| F10 | fetchAll allSettled·실패격리·dedupeById | ✅ |
| F11 | baseline 부재 시 NO_DATA·RECRUIT_CHANGED 미발행 | ✅ |
| F12 | performWork→syncRecruits(source)+runRecruitOnce tick | ✅ |

> Functional 로직은 하네스 50건 + 콘솔 3종 PASS로 인메모리 확인. iterate 전 "스케줄러 프로덕션 실발화 불가"는 로직이 아닌 배포 wiring 결함(S13/C15 귀속)이었고, **2026-09-28 iterate에서 배포 엔트리 정합으로 해소** → Functional은 iterate 전후 모두 12/12(100%) 유지.

### 1.3 Contract (가중치 0.4)

| # | 설계 항목(§) | 일치 |
|---|-------------|------|
| C1 | RecruitSource/Base/Sria/Temp/Recruit union(§2.1) | ✅ |
| C2 | id 규약 "{source}:{localId}"(§3.1) | ✅ |
| C3 | RecruitProvider{source; fetch()}(§2.2) | ✅ |
| C4 | 레지스트리 getProvider/getAllProviders/createDefault(§2.2) | ✅ |
| C5 | TempRuleConfig(§2.4) | ✅ |
| C6 | TempValue/TempField(§2.4) | ✅ |
| C7 | RECRUIT_SYNC_* + RecruitSync*Event(§2.8/§3.2) | ✅ |
| C8 | RECRUIT_CHANGED{added/updated/deletedIds}(§3.2) | ✅ |
| C9 | RecruitTier redis\|firestore\|source\|empty\|error(§3.2) | ✅ |
| C10 | ErrorCategory.SOURCE/sourceFailed/SourceStrategy(§2.8) | ✅ |
| C11 | sourceLogger / LogSource "source"(§2.8) | ✅ |
| C12 | crawl/proxy/RECRUIT_CRAWL_* 심볼 제거(§2.8) | ✅ |
| C13 | dmSender 계약(DmPayload/DmSendResult) 불변(§5) | ✅ |
| C14 | formatJobTitleLink/recruitField 시그니처(§2.7) | ✅ |
| **C15** | **소스별 스케줄 export가 config.schedule로 발화(배포 성공기준 §2.5·§6/OP-U1)** | ✅ (해소) |

---

## 2. 매치율 산출

### 2.1 재분석 (2026-09-28 · iterate C-1 수정 후)

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 14완전 + 1부분 / 15 | 96.7% |
| Functional (×0.4) | 12 / 12 | 100% |
| Contract (×0.4) | 15 / 15 | 100% |
| **종합 매치율** | | **99.3%** |

```
카테고리 점수 = (완전일치 + 부분일치×0.5) / 전체 × 100
Structural = (14 + 1×0.5) / 15 = 96.7%
종합 = 96.7×0.2 + 100×0.4 + 100×0.4 = 99.3%
```

> 변동 요인: C-1(S13/C15) 해소 — S13 ✅·C15 ✅ 전환, E안 게이트웨이 엔트리 S15(✅) 신규 추적. 남은 부분일치는 S14(문서 드리프트)뿐. 🔴 Critical **0건**.

### 2.2 이전 분석 (2026-09-23 · iterate 전 · 참고 보존)

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 12완전 + 1부분 / 14 | 89.3% |
| Functional (×0.4) | 12 / 12 | 100% |
| Contract (×0.4) | 14 / 15 | 93.3% |
| **종합 매치율** | | **95.2%** (C-1 미해소) |

---

## 3. 갭 목록

### 3.1 미구현/부분일치 (iterate 대상)

| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 | 상태 |
|---|----------|----------|--------|---------|------|
| ~~C-1~~ | S+C (S13/C15) | §2.5·§6 | 소스별 스케줄 트리거(`recruitSchedule_sria/_temp`)가 배포 엔트리에 미연결 | ~~P0 🔴~~ | ✅ **해소(2026-09-28)** |
| D-1 | S (S14) | §2.8 파급 | 참조 가이드 .md(SYSTEM_ERROR/LOGGER_GUIDE, events·src·services CLAUDE.md)에 구 crawler/proxy 심볼 잔존(코드는 통일 완료, 문서 드리프트) | P2 | 잔여 |

### ✅ C-1 해소 확인 (2026-09-28 · iterate E안)

- **수정 요지**: E안(하이브리드) — 배포 엔트리를 스케줄러로 전환, 게이트웨이는 standalone 분리.
- **정적 검증(코드 확인)**:
  1. `package.json:19` `main = "lib/app/scheduler.js"` (구 `lib/app/index.js`에서 전환).
  2. 컴파일 산출 `lib/app/scheduler.js`가 `exports.recruitSchedule_sria`/`exports.recruitSchedule_temp`를 `onSchedule(sriaConfig.schedule)`/`onSchedule(tempConfig.schedule)`로 export(line 5-6, 25-32) → **Firebase가 main 모듈의 함수 export를 스캔해 두 스케줄 트리거를 발견·배포**. C-1의 "발견 함수 집합 누락" 근본 증상 제거.
  3. 게이트웨이(인터랙션 수신)는 standalone 엔트리 `app/gateway.ts`(`app.listen` + `/health`) + `bootstrapGateway.ts`(공통 부트스트랩)로 분리. 스케줄러는 `initFunctionProviders`(REST 전용), 게이트웨이는 `initGatewayProviders`(Discord WS 로그인)로 프로바이더 init도 분리.
- **결론**: main→scheduler.js 정합 + 트리거 export 확인 → **C-1 정적 판정상 완전 해소**. Functional 로직은 iterate 전부터 PASS였으므로 종합 매치율 **99.3%, 🔴 Critical 0건**.

### ⚠️ 잔여 리스크 (1.10 매치율 비산정 · 후속 의존)

- **lint predeploy**: `firebase.json` predeploy를 `build`만으로 게이팅(lint 제외). repo-wide lint debt는 **별도 lint-cleanup 태스크**로 분리 → 1.10 스코프 밖(매치율 하락 요인 아님). 다만 완전 자동배포 성립성은 lint 정리에 후속 의존.
- **Secret Manager(O-4)**: Functions 시크릿 주입은 **Phase 1.13**로 이관 → 1.10 스코프 밖.
- **게이트웨이 상주 호스트**: E안은 인터랙션 처리를 위해 standalone 게이트웨이(Oracle Always-Free VM + pm2)의 실제 프로비저닝이 필요. 코드/엔트리는 완비(정적 통과)이나, 실제 상주 기동·인터랙션 왕복은 봇 상시기동이 필요한 런타임 검증(U) 대상 — 매치율 비산정, 운영 의존 리스크로만 기록.

### (이전) 🔴 C-1 상세 (2026-09-23 · iterate 전 기록 보존)

- **증상**: `app/scheduler.ts`에 onSchedule 정의는 있으나, `main`이 가리키는 `app/index.ts`가 `export default appServer`(게이트웨이 onRequest)만 export하고 스케줄 모듈을 import/재export하지 않음 → firebase 발견 함수 집합에서 누락.
- **근본원인**: Phase 1.13 C안(게이트웨이/함수 프로세스 분리)에 **두 진입점을 함께 노출하는 통합 배포 엔트리 부재** — 설계서가 배포 엔트리 통합을 미명세한 설계 공백.
- **정적 판정 근거**: 엔트리 모듈 export 그래프만으로 결정(봇 실행 불필요). 인메모리 로직·하네스는 전부 PASS이므로 코드 로직 자체는 정상.
- **성립 근거(2026-09-23 코드 확인)**: 게이트웨이 WS의 제품 용도는 인터랙션 수신 하나뿐(`discordListeners.ts`=onReady+onPingPongCreate+onInteraction; `MessageCreate`는 ping→pong 개발 에코, DM은 REST). → 인터랙션을 HTTP로 받으면 상시 프로세스 자체가 불요. **별개 블로커**: `firebase.json` predeploy `npm run lint`가 현재 깨져 있어 C-1과 무관하게 실배포도 predeploy에서 실패(실배포 시 동반 수리).
- **수정 방향 후보(iterate에서 택1·승인 후)**:
  - **C안 ★ HTTP Interactions Endpoint** — WS 로그인 제거, onRequest가 인터랙션 HTTP 수신(Ed25519 서명검증). index가 `api`(onRequest)+`recruitSchedule_*`(onSchedule) 동시 export → 단일 main·단일 배포. Functions 100%유지·상시불요·비용0·완전해소(핸들러 재사용, 전달 계층만 교체). **권장**.
  - **E안** 하이브리드 유지 + 게이트웨이를 무료 상시 호스트(Oracle Always-Free/Fly.io 등), 스케줄러는 Functions(`main`→scheduler.js). 저비용·변경 소.
  - **F안** 단일 상시 프로세스 통합(Functions 폐기): WS + `node-cron` 인프로세스 스케줄러(EventBus 동일프로세스로 단순).
  - **1안** Cloud Run min=1(유료 상시) 게이트웨이 + Functions 스케줄러.
  - **2안** `index.ts` 스케줄 재export + top-level 부트스트랩 함수별 조건화(`FUNCTION_TARGET`/`K_SERVICE`) — 게이트웨이-in-function은 WS-in-ephemeral=반쪽. 비권장.
  - **3안** `main`→`scheduler.js` + README(게이트웨이 별도 호스트 문서화). 포트폴리오 정직·비용0.
  - **G안** Firebase 다중 codebase(두 패키지 분리) — 게이트웨이 여전히 상시 필요=반쪽 + 구조개편 대. 비권장.

### 3.2 설계 차이 (허용)

| 설계 | 실제 구현 | 판단 |
|------|----------|------|
| — | 레지스트리에 하위호환 별칭 일부 존재 | 허용 |
| §2.5는 `app/scheduler.ts` 단일 엔트리만 명세(배포 토폴로지 미명세) | E안 2-프로세스 토폴로지: 스케줄러(Functions) + 게이트웨이(standalone VM/pm2), `gateway.ts`·`bootstrapGateway.ts` 신규 | 허용 — C-1(설계 공백) 보강. 설계 의도(소스별 스케줄 배포 발화)를 충족하며 인터랙션 수신 경로를 분리 |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록 (🔴 Critical 0건)

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 | 제안 |
|---|--------|----------|----------|------|------|
| 1 | 🟡 | DRY | `services/recruitService.ts:57-65 ↔ 135-143` | 캐시 백업→CHANGED시 emit→catch warn 블록이 Step2와 collectAndSave에 거의 동일 중복 | private helper(`backupAndEmit`) 추출 |
| 2 | 🟡 | 컨벤션 | `embeds/recruitMessageEmbed.ts:26-38` | 템플릿 리터럴 소스 들여쓰기가 임베드에 렌더, `name:"\n"` 빈 필드명 | description 블록 방식 통일 (**기존 후순위 W1/W2와 동일 항목** — 신규 아님) |
| 3 | 🟡 | 컨벤션 | `schedulers/RecruitScheduler.ts:55-63` | `throw { success:false,... }` — Error 아닌 plain object throw(base가 필드 재계산·대부분 버림) | `throw SystemError.sourceFailed(...)` 또는 실패 WorkResult 반환 |
| 4 | 🟢 | 성능 | `recruitCacheService.ts:126-131,162-170` | for-loop 순차 await(N×2 Redis 왕복) | mock 규모엔 무해, Promise.all 여지(기존 승계) |
| 5 | 🟢 | 컨벤션 | `recruitSourceService.ts` | globalLogger(system) 사용, sourceLogger가 의미상 적합 | 선택적 교체 |
| 6 | 🟢 | 컨벤션 | `schedulers/SchedulerManager.ts:63-75` | getStatus raw map-key 노출(나머지 API는 source 기반) | source 시그니처 통일 |
| 7 | 🟢 | 관찰성 | `services/notificationService.ts:32-45` | 구독자 루프 로깅 없음 | 핸들러+emit 로그로 커버, 수용 가능 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger | ✅ | 대상 코드 console.* 0건 |
| SystemError | ⚠️ | 오용 없음, 단 RecruitScheduler plain throw(#3), source 실패에 sourceFailed 미사용 |
| 네이밍 | ✅ | Pascal/camel/UPPER_SNAKE 준수 |
| import 정리 | ✅ | import type 분리·@/ 절대경로 |
| EventBus 패턴 | ✅ | emitEvent/Settle/onEvent, 헬퍼 통일, 핸들러 try-catch 대칭 |
| 레이어 의존 | ✅ | providers→services 역참조 0 |
| 순수성(temp) | ✅ | 시드 PRNG만, Math.random 0 |
| provider graceful | ✅ | dmSender throw 없음, fetchAll allSettled |
| source/sync rename | ✅ | 실행 코드 활성 crawl/proxy 심볼 0(잔재는 주석·문서뿐) |

### 4.3 요약

- 🔴 Critical: 0건 (Code Analyzer)
- 🟡 Warning: 3건 (#1 DRY / #2 임베드-기존후순위 / #3 non-Error throw)
- 🟢 Info: 4건
- 문서 드리프트 3건 + lint 사전 고장 1건(`.eslintrc.js` ESM/CJS — 내 변경 아님, 정적 게이트 복구용 별도 이슈): 코드 밖, blocker 아님

---

## 5. 다음 단계 분기

✅ **재분석(2026-09-28) 매치율 99.3% (≥90%) · 🔴 Critical 0건** → `review-process.md` 기준 **report 진행 가능**.
- C-1(배포 엔트리 wiring)은 iterate에서 E안으로 해소(§3.1 해소 확인). 정적 판정상 완전 종결.
- 잔여: D-1(문서 드리프트 P2) 1건 — report/정리 사이클에서 병합 처리. Code #1(DRY)/#3(non-Error throw)도 동일.
- 런타임 재검증(선택): OP-U1(실배포 트리거 실발화)·게이트웨이 상주 인터랙션 왕복은 봇 상시기동 필요한 (U) 항목 → 사용자 선택 시 0단계에서 수행. 정적 매치율과 별개.

> **이전 판정(2026-09-23)**: 매치율 95.2% · 🔴 Critical 1건(C-1) 미해소 → iterate 권고였음(해소 완료로 상태 전환).

---

*분석일: 2026-09-23 · 재분석: 2026-09-28 (iterate C-1 해소)*
*참고: 02-design.md, 05-runtime-verification.md, 06-event-case-tests.md*

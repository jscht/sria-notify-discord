# Phase 1.10 갭 분석: Proxy 통합 + 실 CRAWL 활성화 + 프로덕션 배포·E2E

**상태**: 🔍 검토 중
**분석일**: 2026-08-20
**설계서**: `docs/phase-1-10/02-design.md`

> 정적 검증: `npx tsc --noEmit` **0 에러**(기준선 0) / `npm run build`(tsconfig.build + tsc-alias) **exit 0**.
> ⚠️ 세션 한도로 Gap Detector·Code Analyzer 에이전트 대신 메인 컨텍스트에서 직접 분석.

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.1 ProxyStore 상태 메서드 | getAvailableProxies·checkoutProxy(tx)·updateProxyState·markProxyFailed | ✅ Y | `providers/firebase/store/proxy.ts` |
| 2 | §2.2 ProxyService 5메서드 | 전부 구현 + index export | ✅ Y | `services/proxyService.ts` |
| 3 | §2.3 verifyProxy 코어 + CLI | verifyProxy·filterVerifiedProxies·toProxyServer + 스크립트 | ✅ Y | `crawlers/utils/verifyProxy.ts`, `scripts/verifyProxy.ts` |
| 4 | §2.4 SriaCrawler executor | crawl(proxy) 단일 시도 | ✅ Y | `crawlers/strategies/recruit/sria/SriaCrawler.ts` |
| 5 | §2.5 getCookie(context) | 시그니처·URL 정합 | ✅ Y | `crawlers/strategies/recruit/utils/getCookie.ts` |
| 6 | §2.6 crawlService 로테이션+버그수정 | crawlWithProxyRotation·mode 수정 | ✅ Y | `services/crawlService.ts` |
| 7 | §2.7 ProxyScheduler verify+save+event | filterVerifiedProxies→save, 전멸 SYSTEM_ERROR_CRITICAL | ✅ Y | `crawlers/schedulers/ProxyScheduler.ts` |
| 8 | §2.8 ProxyErrorHandler + 임베드 2종 | handler(events/bus/handlers) + embeds(providers) | ✅ Y | `events/bus/handlers/ProxyErrorHandler.ts` 외 |
| 9 | §3.2 PROXY_UNAVAILABLE 이벤트 타입 | enum+payload+map | ✅ Y | `events/bus/types.ts` |
| 10 | §3.1 ProxyDoc 확장 | country·anonymity·verifiedAt·failCount | ✅ Y | `crawlers/types.ts` |
| 11 | §3.1 RecruitStore lastRefreshedAt | 필드+get/set | ✅ Y | `providers/firebase/store/recruit.ts` |
| 12 | §3.1 proxyIncident Redis 헬퍼 | openIfAbsent·resolve | ✅ Y | `services/proxyIncident.ts` |
| 13 | §2.6c emitProxyUnavailable 헬퍼 | awaitSettle 지원 | ✅ Y | `events/bus/utils/emitProxyUnavailable.ts` |
| 14 | §2.8 registerProxyErrorHandlers 등록 | 등록 연결 | ✅ Y | `events/bus/utils/registerEventHandlers.ts` |

**Structural: 14/14 = 100%**

### 1.2 Functional (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §0-1 geo KR 우선 정렬 | country KR 우선+latency asc | ✅ Y | proxy.ts getAvailableProxies |
| 2 | §2.4 ko-KR/Asia-Seoul context | newContext locale/timezoneId | ✅ Y | SriaCrawler |
| 3 | §2.4 WebRTC 차단 arg | disable_non_proxied_udp 등 | ✅ Y | SriaCrawler |
| 4 | §2.6b 세션고정+실패교체(≤3) | MAX_PROXY_ATTEMPTS 루프 | ✅ Y | crawlService |
| 5 | §2.6b hasAvailableProxy 게이트 | 진입 게이트 throw | ✅ Y | crawlService |
| 6 | §2.6bc 소진 시 throw만 | ProxyExhaustedError | ✅ Y | crawlService |
| 7 | §2.9A 스케줄러만 발행/능동 격리 | crawlAndDiff emit·getRecruitList HttpError | ✅ Y | recruitService |
| 8 | §2.8 사용자 staleness 매 틱·전체 구독자 | 전 구독자 루프, 쓰로틀 없음 | ✅ Y | ProxyErrorHandler |
| 9 | §2.8 개발자 1회 DM + id 로그 | openIfAbsent + OPENED/ONGOING/RESOLVED | ✅ Y | ProxyErrorHandler·recruitService |
| 10 | §2.8 as-of 절대+상대 병기 | formatAsOf | ✅ Y | proxyStalenessEmbed |
| 11 | §2.3 elite/protocol/liveness 필터 | XFF/Via·HTTPS·liveness | ✅ Y | verifyProxy |
| 12 | §2.4 차단 감지 (429/403/CAPTCHA/블록/**빈응답**) | 429/403·URL 마커만 — **빈 목록(soft block) 미감지** | ⚠️ P | SriaCrawler isBlocked |
| 13 | §2.6a crawlService mode 버그수정 | mode 전달 | ✅ Y | crawlService |
| 14 | §2.5 getCookie SRIA_URL 정합 | PROXY_URL→SRIA_URL | ✅ Y | getCookie |
| 15 | §2.7 전멸 시 SYSTEM_ERROR_CRITICAL | emitSystemErrorEvent | ✅ Y | ProxyScheduler |
| 16 | §2.9B lastRefreshedAt 성공 시 기록 | setLastRefreshedAt(merge) | ✅ Y | recruitService·recruit.ts |
| 17 | §2.4/C jitter·throttle | collectPages getDelay + backoff | ✅ Y | SriaCrawler·crawlService |
| 18 | §2.4 `--single-process` 제거 재검토 | **유지(미반영)** | ⚠️ P | SriaCrawler BASE_ARGS |

**Functional: (16 + 2×0.5)/18 = 94.4%**

### 1.3 Contract (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §5 dmSender 계약 불변 | DmPayload/DmSendResult 미변경 | ✅ Y | dmSender(무변경) |
| 2 | §범위 getRecruitList 3-tier 보존 | Step4에 try/catch만 추가, tier 로직 무변경 | ✅ Y | recruitService |
| 3 | §2.6c emitProxyUnavailable awaitSettle 틱 완결 | awaitSettle:true | ✅ Y | recruitService |
| 4 | §2.4/2.6 ProxyBlockedError/ProxyExhaustedError | 계층별 에러 정의 | ✅ Y | crawlers/errors·services/errors |
| 5 | §2.6c crawlAndDiff 소진 시 동작 | 설계=throw / 구현=**empty 반환**(발행 후 tick 정상종료) | ⚠️ P | recruitService |
| 6 | 레이어 규칙(crawlers→services 무참조, provider→services/events 무참조) | 준수(임베드 primitive 입력, executor 무참조) | ✅ Y | 전반 |
| 7 | BaseCrawler.crawl 시그니처 | `(...args)`로 완화(하위호환) | ✅ Y | BaseCrawler |
| 8 | SriaCrawler executor 계약 | proxy 주입·ProxyBlockedError throw | ✅ Y | SriaCrawler |

**Contract: (7 + 1×0.5)/8 = 93.75%**

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 14/14 | 100% |
| Functional (×0.4) | 16+2P/18 | 94.4% |
| Contract (×0.4) | 7+1P/8 | 93.75% |
| **종합 매치율** | | **95.3%** |

```
종합 = 100×0.2 + 94.4×0.4 + 93.75×0.4 = 20 + 37.76 + 37.5 = 95.26 ≈ 95.3%
```

---

## 3. 갭 목록

### 3.1 미구현 항목
| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| 1 | F | §2.4 | `isBlocked`가 **빈 목록(soft block)** 미감지 — 200이지만 빈 응답인 차단 프록시가 성공 처리되어 markProxyAsFailed 안 됨 | P1 |
| 2 | F | §2.4 | `--single-process` 제거 재검토 미반영(유지) — 프록시 컨텍스트 안정성 리스크 | P2 |

### 3.2 설계 차이 (의도적)
| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | crawlAndDiff 소진 시 throw | empty 반환(발행 후 tick 정상종료) | 허용 — 재시도 스톰·함수 에러 방지 |
| 2 | toPlaywrightProxy를 crawlService 소유 | crawlers/utils `toProxyServer`(공용) | 허용 — verifyProxy·crawlService DRY |
| 3 | proxyIncidentEmbed(payload, incident) | primitive 입력 | 허용 — provider 레이어 규칙 |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록
| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟡 | 정확성 | SriaCrawler.ts `isBlocked` | 빈 응답 soft-block 미감지 (갭 §3.1-1) | 첫 페이지 추출 0건 시 ProxyBlockedError로 승격 |
| 2 | 🟡 | 안정성 | SriaCrawler.ts BASE_ARGS | `--single-process` 유지 시 프록시 컨텍스트 크래시 가능 | 제거 후 로컬 검증 |
| 3 | 🟢 | DRY | proxyStalenessEmbed/proxyIncidentEmbed | KST 시각 포맷터 2개 중복 | 공용 date util 추출(선택) |
| 4 | 🟢 | DRY | verifyProxy.ts | launch args 2회·SriaCrawler와도 중복 | 공용 상수화(선택) |
| 5 | 🟢 | 효율 | crawlService backoff | 마지막 시도 실패 후에도 backoff 후 throw | 마지막 attempt는 backoff 생략 |
| 6 | 🟢 | 미사용 | ProxyService.markProxyAsUsed | 호출처 없음(설계상 "명시용" 보존) | 유지 or 제거 |
| 7 | 🟢 | 운영 | ProxyErrorHandler | 장기 소진 시 매 4h 전 구독자 staleness DM(사용자 결정) 순차 발송 부하 | 구독자 급증 시 배치 발송 후속 검토 |

### 4.2 컨벤션 준수
| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger 사용 | ✅ | globalLogger/crawlerLogger/providerLogger. console은 `scripts/` CLI만(빌드 제외) |
| SystemError 패턴 | ✅ | ProxyScheduler emitSystemErrorEvent, HttpError 변환 |
| 네이밍 규칙 | ✅ | camelCase/PascalCase 준수 |
| import 정리 | ✅ | index export 경유 |
| 레이어 규칙 | ✅ | crawlers→services 무참조, provider→services/events 무참조 |
| dmSender 계약 | ✅ | 불변 |

### 4.3 요약
- 🔴 Critical: **0건**
- 🟡 Warning: **2건** (isBlocked soft-block, --single-process)
- 🟢 Info: 5건

---

## 5. 다음 단계 분기

✅ **매치율 95.3% (≥90%) AND 🔴 Critical 0건** → `/pdca report 1.10` 진행 가능 (CTO Lead 게이트 생략 조건 충족).

- 선택: 🟡 Warning 2건(soft-block 감지·single-process)을 report 전 **경량 개선**할지 사용자 결정.
- 선택: 실 CRAWL·배포·프로덕션 E2E + `verifyProxy` (C) 하니스는 **런타임 검증(review-process 0단계, U)**에서 수행 — B9 License/Compliance 게이트 포함.

---

*분석일: 2026-08-20*
*참고: docs/phase-1-10/02-design.md*

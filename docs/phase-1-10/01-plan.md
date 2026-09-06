# Phase 1.10: Proxy 통합 + 실 CRAWL 활성화 + 프로덕션 배포·E2E

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.2, 1.8, 1.13 완료

---

## 개요

### 배경
Phase 1.13이 런타임 재설계(**코드 + 로컬 한정**)를 끝내며 실배포·실 CRAWL·프로덕션 E2E를 1.10으로 이월했다. 진입점은 이미 C안으로 완성되어 있다:
- `app/scheduler.ts` — `recruitSchedule = onSchedule("every 4 hours")` → `runRecruitOnce(CRAWL_MODE.CRAWL)` (이미 CRAWL 지정)
- `app/index.ts` — gateway(인터랙션 상시), `dmSender` REST 전용 완료

따라서 1.10의 실체는 **프록시로 차단을 회피(+로컬 실행 시 개인 IP 은닉)하며 실 CRAWL을 켜고, GCP(Blaze)에 배포해 프로덕션 파이프라인(크롤→diff→DM)을 완결**하는 것이다. 현재 프록시 계층은 절반만 구현돼 실 크롤을 안전하게 켤 수 없고, 실 CRAWL 경로에 잠복한 버그가 있다.

### 목표
- 크롤은 **환경 무관 상시 로테이팅 프록시**를 경유(차단 회피 주목적, 로컬 실행 시 개인 IP 은닉 부가효과).
- 프록시 계층 완성(저장·서비스·주입·로테이션·차단감지)과 실 CRAWL 경로 버그 수정.
- GCP 실배포 후 실제 스케줄 주기에서 크롤→diff→DM 파이프라인이 완결됨을 (U) 런타임검증으로 확인.

### 범위

| 포함 | 제외 |
|------|------|
| ProxyScheduler 저장 연결 + 저장 전 liveness 재검증 + 수집 실패 이벤트 | 유료 프록시 도입 (무료 1차, 유료는 승급 경로) |
| ProxyService 구현 (getAvailableProxy/markProxyAsUsed/markProxyAsFailed/releaseProxy/hasAvailableProxy) | AI/NLP·관리자 공지 등 타 Phase |
| SriaCrawler 프록시 주입 + hasAvailableProxy 게이트 + 세션당 고정·실패/차단 시 교체(≤3) | recruitService 3-tier 사용자 경로 변경 (보존) |
| 차단 감지(429/CAPTCHA/블록/빈응답)·지수 백오프·jitter·stealth geo 정합·WebRTC 누수 차단 | dmSender 계약 변경 (DmPayload/DmSendResult 불변) |
| `getCookie` 프록시·stealth 경유 + 대상 URL 정합, `crawlService.ts:28` DUMMY 버그 수정 | 직접 크롤 폴백 (차단 회피 원칙 우선 — 미채택) |
| ProxyErrorHandler(`events/bus/handlers/`) + staleness/개발자 임베드(`providers/discord/builder/embeds/`) + RecruitStore `lastRefreshedAt` | |
| IP 우회 검증 하니스(`verifyProxy`) + 실 CRAWL 활성화(프록시 게이트 경유 보장) | |
| License/Compliance 재확인 (ToS/robots/개인정보) | |
| **(U)** GCP Blaze 실배포 + 프로덕션 E2E (R4/R5/DM분기/부하/로그) | |

---

## 요구사항

### 기능 요구사항
1. **프록시 영속화 + 검증**: ProxyScheduler가 6시간마다 수집 → **저장 전 `verifyProxy` 재검증(elite·HTTPS/SOCKS5·liveness)** → 통과분만 `ProxyStore.saveProxyList` 저장, 수집 전멸 시 **`SYSTEM_ERROR_CRITICAL`(기존 재사용, `service:"ProxyScheduler"`)** 발행.
2. **ProxyService**(소스 무관 인터페이스 — 무료→유료 교체 대비): `getAvailableProxy`(available && !used, latency 우선) / `markProxyAsUsed` / `markProxyAsFailed`(available=false) / `releaseProxy`(used 해제) / `hasAvailableProxy`.
3. **프록시 주입·로테이션 (레이어 분리)**: `SriaCrawler`는 주입받은 프록시로 **단일 시도 executor**(차단 시 `ProxyBlockedError` throw). 게이트(`hasAvailableProxy`)·세션고정·실패교체(≤3)·상태전이 **오케스트레이션은 `crawlService`(services) 소유**, 소진 시 `ProxyExhaustedError` throw(이벤트 발행은 호출자). context 단위 `newContext({ proxy })`, `ProxyData.type`(HTTP/HTTPS/SOCKS5)→`server` 스킴 매핑.
4. **IP 우회 정합·누수 차단**: stealth 유지 + 프록시 geo와 locale/timezone/UA 정합(ko-KR·Asia/Seoul), 요청 간 jitter, WebRTC non-proxied UDP 차단(launch arg), 429/CAPTCHA/블록/빈응답 감지 → 지수 백오프.
5. **getCookie 수정**: 쿠키 취득 흐름에도 프록시·stealth 적용(실 IP 노출 차단), 대상 URL을 saramin(`SRIA_URL`)으로 정합.
6. **crawlService 버그 수정**: `getCityFilteredList(mode, city, scraped)` — CRAWL 모드에서 실크롤 결과가 필터로 전달되게.
7. **staleness 알림 + 발행 격리**: **스케줄 갱신(crawlAndDiff) 실패에서만 `PROXY_UNAVAILABLE` 발행** → `ProxyErrorHandler`가 활성 구독자에 **신선도 안내(마지막 갱신 `lastRefreshedAt` + 사람인 링크, 매 틱 지속)** + 개발자 **incident당 1회 DM**(발생/복구는 incident id 로그). **능동 요청 실패는 발행 없이 요청자에게만 안내**(전체 브로드캐스트 격리). RecruitStore `lastRefreshedAt` 필드 추가(성공 크롤 시 기록).
8. **실 CRAWL 활성화**: onSchedule 경로(`runRecruitOnce(CRAWL)`)가 프록시 게이트를 반드시 경유하도록 보장.

### 비기능 요구사항
- **성능**: 순차 발송 블로킹 비용은 프로덕션 E2E 부하 항목에서 실측.
- **호환성**: dmSender 계약(DmPayload/DmSendResult) 불변, 사용자 요청 경로(`getRecruitList` 3-tier) 회귀 없음.
- **에러 처리**: SystemError 패턴, providerLogger/systemLogger 사용.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js 18) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Crawling | Playwright 1.47 + playwright-extra + puppeteer-extra-plugin-stealth |
| Messaging | discord.js 14.17 (REST) |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식
프록시 목적을 **차단 회피(주) + 개인 IP 은닉(부가, 로컬 실효)**로 정의하고, **환경 무관 상시 로테이션**(세션당 고정 + 실패/차단 시 교체 ≤3)을 적용한다. 무료 ProxyCrawler를 재사용하되 **저장 전 liveness/elite/프로토콜 재검증**으로 품질을 끌어올리고, ProxyService를 소스 무관 인터페이스로 두어 부족 시 유료 게이트웨이로 승급 가능하게 한다. 개인 IP 은닉 성립을 위해 **누수 차단 3종**(WebRTC UDP 차단·getCookie 프록시 경유·elite만)을 강제하며, 이는 차단 회피에도 동시에 기여한다.

### IP 우회 → 크롤 애플리케이션 전개도
```
onSchedule("every 4h")            ── app/scheduler.ts
  └─ runRecruitOnce(CRAWL)        ── SchedulerManager
      └─ RecruitScheduler.performWork
          └─ recruitService.crawlAndDiff(CRAWL)   [Redis 분산 락]
              └─ crawlService.sriagent(CRAWL)      ★버그수정: mode 전달 + 로테이션(소진 시 throw)
                  ├─ proxyService.hasAvailableProxy() ── 게이트: false면 throw
                  ├─ proxyService.getAvailableProxy()  ── 세션 고정 프록시 1개 checkout
                  └─ SriaCrawler.crawl(proxy)          ── 주입만(executor)
                        ├─ 성공 → releaseProxy → return
                        └─ ProxyBlockedError → markProxyAsFailed → 재시도(≤3) → 전부 실패 시 throw
          (crawlAndDiff 결과 분기)
          ├─ 성공 → setRecruitList(lastRefreshedAt 기록) → RECRUIT_CHANGED → NOTIFICATION_SEND → dmSender
          └─ ProxyExhaustedError → emit PROXY_UNAVAILABLE(★스케줄러만) → ProxyErrorHandler
                ├─ 구독자 staleness 안내(매 틱)   └─ 개발자 incident 1회 + id 로그
      [능동 경로] getRecruitList Step4 소진 → HttpError → 요청자에게만 안내(브로드캐스트 X)
```

### 네트워크 계층 흐름 (프록시 터널링 — "3-way handshake" 관점)
프록시는 **HTTP CONNECT 터널**(HTTP/HTTPS) 또는 **SOCKS5**로 동작. saramin은 HTTPS이므로 TLS는 브라우저↔타깃 **종단 간**이고 프록시는 암호문만 중계 → 실 IP 은닉.
```
[Chromium(proxy)]              [Proxy 서버]              [saramin:443]
  │ (1) TCP 3-way ──▶  (프록시 연결 수립)                     │
  │ (2) CONNECT saramin:443 ──▶  (3) TCP 3-way ──▶            │
  │ ◀── (4) 200 Connection Established (터널 개통)            │
  │ (5) TLS ClientHello ──(터널 통과, 프록시는 평문 못 봄)──▶  │
  │ ◀────────── TLS handshake (종단간) ──────────             │
  │ (6) HTTP GET /jobs ──(암호화)──▶                          │
  │ ◀── 응답 (saramin이 보는 Source IP = 프록시 IP)          │
```
- **SOCKS5**: (1) 이후 SOCKS greeting/인증/CONNECT 협상으로 (2)~(4) 대체.
- **⚠ WebRTC 누수**: STUN으로 프록시 우회 UDP가 열리면 실 IP 누출 → launch arg로 차단 필수.

### Playwright 탐지 우회 설정 방침
| 항목 | 방침 |
|------|------|
| stealth 플러그인 | `chromium.use(stealth())` 유지 |
| UA 정합 | 랜덤 UA를 Chromium 버전과 정합 (엔진 불일치 UA는 탐지 신호) |
| locale/timezone/geo | `newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul' })` — 프록시 geo 정합/불일치 트레이드오프 design 확정 (KR 프록시 우선) |
| viewport/fingerprint | 현실적 viewport·deviceScaleFactor, `--single-process` 재검토 |
| WebRTC 차단 | `--force-webrtc-ip-handling-policy=disable_non_proxied_udp` 등 |
| 행위 위장 | 요청 간 jitter(`getDelay`)·throttle, 10분 쿨다운(`isRequestAllowed`) 정합 |
| 차단 감지 | 429/CAPTCHA/로그인·블록 리다이렉트/빈 목록 → markProxyAsFailed + 교체 + 지수 백오프 |

### IP 우회 검증 하니스 (verifyProxy — (C) Claude 로컬 실행)
실 사람인 크롤 없이 IP 에코 사이트로 프록시 적용을 결정적으로 검증(부작용 없음 → analyze에서 Claude 실행·판정 가능):
- `functions/scripts/verifyProxy.ts`(tsx): ① 직접 IP ② 프록시 경유 IP를 취득해 **상이 + geo** 확인.
- 엔드포인트: `https://api.ipify.org?format=json`, `https://httpbin.org/ip`, `http://ip-api.com/json`(geo).
- WebRTC 누수: 차단 arg 적용 후 실 IP 미노출 확인(수동/보조).
- 프록시 주입·로테이션 로직의 단위 검증으로도 재사용 → SriaCrawler 통합 전 프록시 경로 독립 확인.

### 프록시 소스 타당성 (무료 사용 가능성 + 대안)
**현재 ProxyCrawler 필터 공백 3종**: 익명등급(transparent 포함) 미필터 → `X-Forwarded-For` 실 IP 누수 / 프로토콜(HTTPS·SOCKS5) 미필터 → HTTPS CONNECT 미지원 실패 / liveness 미검증 → 크롤 시점 dead 빈번. **무료 공개 프록시 한계**: 수명 짧음·속도 편차·대부분 non-KR(geo 불일치)·MITM 가능(단 HTTPS 본문은 TLS 보호).
**결정**: 무료 재사용 + 저장 전 재검증(elite·HTTPS/SOCKS5·liveness)으로 1차 사용, 런타임검증에서 고갈 시 **유료 로테이팅 게이트웨이 승급**. ProxyService 인터페이스는 소스 무관.

### 영향 받는 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `crawlers/schedulers/ProxyScheduler.ts` | 수정 | `saveProxyList` 연결 + 저장 전 verifyProxy 재검증 + 수집 실패 이벤트 |
| `services/proxyService.ts` | 신규 | 5메서드 + `services/index.ts` export |
| `crawlers/types.ts` | 수정 | ProxyDoc 상태(available/used) 활용·필요 시 확장 |
| `crawlers/strategies/recruit/sria/SriaCrawler.ts` | 수정 | proxy 주입(context)·게이트·로테이션·차단감지·백오프·jitter·WebRTC 차단 arg |
| `crawlers/strategies/recruit/utils/getCookie.ts` | 수정 | 프록시·stealth 경유(실 IP 노출 차단), 대상 URL을 SRIA_URL로 정합 |
| `functions/scripts/verifyProxy.ts` | 신규 | IP 에코 사이트 프록시 검증 하니스 (tsx, (C) 로컬) |
| `services/crawlService.ts` | 수정 | 28행 mode 버그 수정 + 프록시 로테이션(소진 시 `ProxyExhaustedError` throw) |
| `services/recruitService.ts` | 수정 | crawlAndDiff: 소진 시 `PROXY_UNAVAILABLE` 발행 + 성공 시 `lastRefreshedAt` 기록·incident resolve |
| `providers/firebase/store/recruit.ts` | 수정 | `lastRefreshedAt` 필드 추가(성공 크롤 시 기록, staleness as-of) |
| `events/bus/handlers/ProxyErrorHandler.ts` | 신규 | `PROXY_UNAVAILABLE` 리스너 (구독자 staleness + 개발자 incident 1회) |
| `providers/discord/builder/embeds/proxyStalenessEmbed.ts`·`proxyIncidentEmbed.ts` | 신규 | 사용자 신선도·개발자 임베드 |
| `events/bus/types.ts` | 수정 | `PROXY_UNAVAILABLE` 이벤트 추가 (수집 전멸은 기존 `SYSTEM_ERROR_CRITICAL` 재사용) |
| `events/bus/utils/registerEventHandlers.ts` | 수정 | `registerProxyErrorHandlers()` 등록 |

### 의존성 분석
- **의존(선행 완료)**: 1.2(스케줄러 이벤트), 1.8(dmSender 계약), 1.13(onSchedule·runRecruitOnce·crawlAndDiff·REST dmSender).
- **후속 영향**: 2.1(auto-error-reporting)이 `SYSTEM_ERROR_CRITICAL` 소비 핸들러를 등록하면 프록시 개발자 알림도 그쪽으로 이관 예정(현재는 `ProxyErrorHandler`가 직접 DM — 임시).

---

## 위임 계획 (§CTO Lead 대행)

> 세션 한도로 CTO Lead 에이전트 호출 불가 → 위임안 직접 제시. plan 승인이 게이트 역할.

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|-----------|------|-------------|
| 프록시 저장·서비스·상태모델 | Integration Lead (+ Backend Expert: Firestore proxy 상태 필드) | 데이터 파이프라인·서비스 오케스트레이션 | ProxyScheduler 저장 연결, `proxyService.ts`, ProxyDoc 상태 |
| SriaCrawler 프록시 주입·로테이션·차단감지 | Integration Lead (크롤 파이프라인) | 크롤 경로·프록시 흐름 조율 | proxy 주입·게이트·재시도·백오프·jitter·WebRTC 차단 |
| ProxyErrorHandler + 임베드 2종 | Discord Agent (임베드) + Integration Lead (핸들러·이벤트 배선) | DM 전송 + 리스너 | `events/bus/handlers/`, `providers/discord/builder/embeds/` |
| crawlService/getCookie 수정 | Integration Lead (경량, 메인 처리 가능) | 정합성 수정 | 버그 수정 2건 |
| 실 CRAWL 합법성 재확인 | License/Compliance | ToS/robots/개인정보 게이트 | compliance 결과 |
| 배포·프로덕션 E2E | **사용자 (U)** | Blaze 과금·실 크롤·실 전송 대행 불가 | R4/R5/DM분기/부하/로그 |

---

## 성공 기준

- [ ] SriaCrawler가 프록시를 통해서만 크롤 (프록시 없으면 크롤 금지)
- [ ] 프록시 1개 실패 시 다른 프록시 자동 전환(최대 3회), 스케줄 갱신 전부 불가 시 구독자 staleness 안내(매 틱) + 개발자 incident 1회
- [ ] ProxyScheduler가 6시간마다 프록시 목록 갱신·(재검증 후)Firestore 저장
- [ ] 로테이션(세션 고정+실패 교체) + stealth + 차단감지·백오프로 실 CRAWL 중 IP 차단 없이 지속 수집
- [ ] `crawlService`·`getCookie` 버그 수정으로 CRAWL 모드 실크롤 데이터가 필터로 전달
- [ ] **(C)** IP 우회 검증 하니스로 프록시 경유 IP ≠ 실 IP + WebRTC 실 IP 미노출 확인
- [ ] TypeScript 컴파일 성공 + 정적 analyze 통과
- [ ] 기존 기능 정상 동작 확인 (사용자 요청 3-tier 경로 회귀 없음)
- [ ] **(U)** GCP 실배포 후 실제 스케줄 주기에서 크롤→diff→DM 파이프라인 완결

### (U) 프로덕션 런타임검증 체크리스트 (analyze 통과 후 · review-process 0단계)
- R4 — ready race 해소: 첫 크롤이 ready보다 빨라도 DM 유실 없음 (실 타이밍)
- R5 — ready 로그 / HTTP 비결합 / graceful shutdown
- DM 에러분기 — 50007 graceful skip, 429 대기·재시도
- 부하 — 구독자 증가 시 처리량·타임아웃·429 지점, 순차 발송 블로킹 영향
- 로그 — Cloud Logging 전 레벨 적재·심각도 매핑·핵심 이벤트 추적

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 무료 프록시 품질/가용성 (풀 고갈 시 갱신 중단) | 높음 | 저장 전 liveness 재검증 + 6h 갱신 + `PROXY_UNAVAILABLE` staleness 안내 + 유료 승급 경로 |
| 사람인 ToS/robots | 높음 | License/Compliance 재확인 게이트 (실 CRAWL 활성화 전) |
| Blaze 과금 | 중간 | onSchedule 4h 주기·runOnce 단일 tick로 제한 |
| 프록시 geo ↔ locale/UA 불일치 | 중간 | design에서 정합 규칙 확정 (KR 프록시 우선) |
| WebRTC/getCookie 실 IP 누수 | 높음 | UDP 차단 arg + getCookie 프록시 경유 + elite만 사용 (은닉 성립 전제) |

---

*작성일: 2026-08-15*
*시드: .claude/phases/phase-1-core.md*

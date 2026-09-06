# Phase 1.10 설계서: Proxy 통합 + 실 CRAWL 활성화 + 프로덕션 배포·E2E

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-10/01-plan.md`

---

## 0. 핵심 결정 4건 (design 확정 사항)

| # | 결정 | 확정 내용 |
|---|------|----------|
| 1 | geo ↔ locale 정합 | **A. KR 우선 + ko-KR/Asia-Seoul 고정** — 수집·정렬에서 country=KR 우선, 비-KR이어도 브라우저 `locale:'ko-KR'`·`timezoneId:'Asia/Seoul'` 고정("해외 접속 한국 사용자" 모델) |
| 2 | 이벤트 계약 | **수집 실패 = 기존 `SYSTEM_ERROR_CRITICAL` 재사용**(`service:"ProxyScheduler"`) / **`PROXY_UNAVAILABLE`만 신규**. `PROXY_UNAVAILABLE`은 **스케줄 갱신 실패에서만 발행**(§2.9-A) — 능동 요청 실패는 이벤트 발행 없이 요청자에게만 안내 |
| 3 | 상태 전이·동시성 | ProxyDoc `available`/`used` 전이 + Firestore **트랜잭션**으로 getAvailableProxy의 원자적 checkout. crawlAndDiff Redis 락이 크롤 자체를 직렬화하므로 경합은 최소 |
| 4 | 주입 방식 | **context 단위** `browser.newContext({ proxy })` (재기동 없이 로테이션) + WebRTC non-proxied UDP 차단 launch arg |
| 5 | **저하 UX 모델** | 크롤/프록시 갱신 실패 시 **"신선도(staleness) 안내"** — 마지막 갱신 시각(`lastRefreshedAt`) + 사람인 직접 확인 링크. **사용자 안내는 갱신 안 되는 한 매 스케줄 틱 지속**, **개발자 알림은 incident당 1회**. 상세 §2.9 |
| 6 | **proxyError 계층 배치** | 핸들러 = **`events/bus/handlers/ProxyErrorHandler.ts`**(이벤트 반응형, `NotificationSendHandler`와 동종 — `features/` 아님) / 임베드 = **`providers/discord/builder/embeds/`**(기존 임베드 빌더 컨벤션). seed의 `features/proxyError/**`는 코드 컨벤션과 불일치하여 정정(SoT: 1순위 Codebase) |

> ⚠️ seed·일부 CLAUDE.md의 `error.critical`은 **stale** — 실제 코드는 `SYSTEM_ERROR_CRITICAL = "system_error:critical"`. 본 설계는 실제 코드 기준(SoT).

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Services (`services/`) | **신규** `proxyService.ts`(5메서드) + `services/index.ts` export / `crawlService.ts` mode 버그 수정 + **프록시 게이트·로테이션**(§2.6, 소진 시 throw만) / `recruitService.crawlAndDiff` **스케줄 갱신 실패 시 `PROXY_UNAVAILABLE` 발행 + 성공 시 incident 리셋**(§2.6) |
| Providers (`providers/firebase/store/`) | `proxy.ts`: 쿼리·상태 업데이트(getAvailableProxies, checkout, updateProxyState) / **`recruit.ts`: `lastRefreshedAt` 필드 추가**(성공 크롤 시 기록, staleness 안내에 사용) |
| Providers (`providers/discord/builder/embeds/`) | **신규** `proxyStalenessEmbed.ts`(사용자 신선도 안내: as-of + 링크) · `proxyIncidentEmbed.ts`(개발자용) — 기존 `notificationMessageEmbed` 컨벤션 |
| Crawlers (`crawlers/`) | `SriaCrawler` 프록시 주입 **단일 executor**(services 무참조, ProxyBlockedError) / `getCookie.ts` 프록시·URL 정합 / **신규** `utils/verifyProxy.ts`(재검증 코어) / `ProxyScheduler` 저장·검증·실패이벤트 |
| EventBus (`events/bus/`) | `types.ts` `PROXY_UNAVAILABLE` 추가(enum+payload+map) / **`handlers/ProxyErrorHandler.ts` 신규**(이벤트 반응형) / `registerEventHandlers.ts` 등록 |
| Scripts (`functions/scripts/`) | **신규** `verifyProxy.ts` (tsx CLI 래퍼, (C) 로컬 검증) |
| Common Types (`crawlers/types.ts`) | ProxyDoc 상태 필드 확장 (`country`, `anonymity`, `verifiedAt`, `failCount?`) |

### 1.2 컴포넌트 다이어그램
```
onSchedule("every 4h") ──▶ SchedulerManager.runRecruitOnce(CRAWL)
                                  │
                    RecruitScheduler.performWork
                                  │
                    recruitService.crawlAndDiff(CRAWL) ──[Redis 락]
                       │
                       ├─ 성공 → setRecruitList(lastRefreshedAt 기록) → incident 리셋
                       │         → diff → RECRUIT_CHANGED → NOTIFICATION_SEND → dmSender(REST)
                       │
                       └─ crawlService.sriagent(CRAWL) throw (프록시 소진)
                             │  ★스케줄 갱신 실패이므로 여기서만 발행
                             ▼
                          emit PROXY_UNAVAILABLE ──▶ [EventBus] ──▶ ProxyErrorHandler
                                                                      ├─ 구독자 전체: staleness 안내(매 틱 지속)
                                                                      │   "마지막 갱신 <lastRefreshedAt> · 직접확인 <링크>"
                                                                      └─ 개발자: incident당 1회 DM

  crawlService.sriagent(CRAWL)  ★mode 버그수정 + 로테이션(소진 시 throw만, 발행 X)
        ├── proxyService.hasAvailableProxy() ──false──▶ throw
        └── proxyService.getAvailableProxy() (트랜잭션 checkout)
                    SriaCrawler.crawl(proxy)  ← 주입만(executor, ko-KR·WebRTC차단)
                       │  성공 → releaseProxy → return
                       │  ProxyBlockedError → markProxyAsFailed → 재시도(≤3)
                       └─ 전부 실패 → throw (호출자가 판단)

  [능동 경로] getRecruitList(3-tier) Step4 크롤 소진 → HttpError → 요청자에게만 as-of+안내 (브로드캐스트 X)

[별도 스케줄] ProxyScheduler(6h) → ProxyCrawler.crawl() → verifyProxy(elite·HTTPS/SOCKS·liveness)
                                → ProxyStore.saveProxyList(통과분) / 실패 시 SystemError(CRITICAL)
```

---

## 2. 상세 설계

### 2.1 ProxyStore 확장 (데이터 접근)

**파일**: `providers/firebase/store/proxy.ts`

기존 `getProxyList`/`saveProxyList` 유지 + 상태 관리 메서드 추가:
```typescript
// available==true && used==false 프록시 조회 (country KR 우선, latency asc)
async getAvailableProxies(): Promise<ProxyDoc[]>;

// 원자적 checkout: 트랜잭션으로 used=false 확인 후 used=true 세팅. 경합 시 null.
async checkoutProxy(ipAddress: string): Promise<ProxyDoc | null>;

// 상태 부분 업데이트 (available/used/failCount)
async updateProxyState(ipAddress: string, patch: Partial<Pick<ProxyDoc,
  "available" | "used" | "failCount">>): Promise<void>;
```
- 문서 ID = `ipAddress` (기존 saveProxyList 규약 유지, `INIT_DOC_ID`="init" 제외).
- `providerLogger` 사용, provider→services 참조 금지 규칙 준수.

### 2.2 ProxyService (비즈니스 로직)

**파일**: `services/proxyService.ts` (신규) + `services/index.ts` export

**인터페이스** (소스 무관 — 무료→유료 게이트웨이 교체 대비):
```typescript
export class ProxyService {
  private readonly store = new ProxyStore();

  /** available && !used 중 country KR 우선·latency 최소 1개를 원자적 checkout(used=true). 없으면 null. */
  async getAvailableProxy(): Promise<ProxyDoc | null>;

  /** checkout된 프록시를 사용중 표시 (getAvailableProxy가 트랜잭션으로 이미 수행 — 명시 호출용/재확인). */
  async markProxyAsUsed(ipAddress: string): Promise<void>;

  /** 차단·연결 실패 → available=false, failCount++ (풀에서 제외). */
  async markProxyAsFailed(ipAddress: string): Promise<void>;

  /** 세션 종료 → used=false (풀 반환, available 유지). */
  async releaseProxy(ipAddress: string): Promise<void>;

  /** 가용 프록시 존재 여부 (게이트용). */
  async hasAvailableProxy(): Promise<boolean>;
}
```
**상태 전이**:
```
저장(verify 통과) → available=true, used=false
  ├─ getAvailableProxy → used=true (checkout, 트랜잭션)
  │     ├─ releaseProxy → used=false (재사용 가능)
  │     └─ markProxyAsFailed → available=false (제외)
  └─ (6h 재수집 시 verify 재통과분으로 갱신)
```
**에러 처리**: 조회/업데이트 실패는 SystemError(WARNING)로 감싸고, 게이트(`hasAvailableProxy`)는 안전하게 false 반환(크롤 중단 우선).

### 2.3 verifyProxy 재검증 코어

**파일**: `crawlers/utils/verifyProxy.ts` (신규, 재사용 코어)

```typescript
export interface ProxyVerifyResult {
  ok: boolean;                 // liveness 통과
  elite: boolean;              // 프록시 IP만 노출 + XFF/Via 누수 없음
  proxyIp?: string;            // 대상이 본 origin IP
  country?: string;            // ip-api geo
  protocolOk: boolean;         // HTTPS(CONNECT) 또는 SOCKS 터널 성립
  latencyMs: number;
}

/** 프록시 1개를 IP 에코로 검증 (실 사람인 크롤 없음, 부작용 0). */
export async function verifyProxy(proxy: ProxyData): Promise<ProxyVerifyResult>;

/** 통과분만 반환 (elite && protocolOk && ok && latency<임계). ProxyScheduler가 저장 전 호출. */
export async function filterVerifiedProxies(list: ProxyData[]): Promise<ProxyDoc[]>;
```
- 검증 엔드포인트: `https://api.ipify.org?format=json`(ip), `https://httpbin.org/ip`(origin), `https://httpbin.org/headers`(XFF/Via 누수 → elite 판정), `http://ip-api.com/json`(country geo).
- **elite 판정**: origin이 프록시 IP 단일 + `X-Forwarded-For`/`Via`/`X-Real-IP` 부재.
- **country**: KR 우선 정렬 키로 사용 (결정 #1).
- Playwright context에 proxy 주입 후 위 엔드포인트 접속으로 판정. 병렬 상한(예: 5~10)으로 실행.

### 2.4 SriaCrawler 프록시 주입·차단감지 (단일 시도 executor)

**파일**: `crawlers/strategies/recruit/sria/SriaCrawler.ts` (수정)

> ⚠️ **레이어 규칙**: crawlers 계층은 services(proxyService)를 참조하지 않는다(기존 방향 services→crawlers 유지). 따라서 **게이트·로테이션·상태전이 오케스트레이션은 crawlService(services, §2.6)가 소유**하고, SriaCrawler는 **주입받은 프록시로 1회 시도만 수행**하는 순수 executor다. 차단 감지 시 `ProxyBlockedError`를 throw해 상위(crawlService)가 로테이션을 판단한다.

```typescript
/** 프록시 1개를 주입받아 단일 크롤 시도. 차단 감지 시 ProxyBlockedError throw. */
async crawl(proxy: PlaywrightProxy): Promise<RecruitData[]> {
  chromium.use(stealth());
  const browser = await chromium.launch({ args: [...BASE_ARGS, ...WEBRTC_BLOCK_ARGS], headless: true });
  try {
    const context = await browser.newContext({
      proxy, userAgent: getRandomUserAgent(),
      locale: "ko-KR", timezoneId: "Asia/Seoul",
      extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    const cookies = await getCookie(context);                 // ★프록시 context로 SRIA_URL 접속(§2.5)
    if (!cookies) throw new Error("Missing cookies");
    await context.addCookies(cookies);
    const page = await context.newPage();
    const resp = await page.goto(process.env.SRIA_URL!, { waitUntil: "domcontentloaded", timeout: getDelay(2) });
    if (isBlocked(resp, page)) throw new ProxyBlockedError();  // 429/403/CAPTCHA/리다이렉트/빈응답
    return await this.collectPages(page);                     // 기존 페이지네이션 루프 + jitter
  } finally {
    await browser.close();
  }
}
```

**보조 요소** (crawlers 계층 내부 — services 무참조):
- `PlaywrightProxy` 타입 = `{ server: string }` (Playwright `newContext.proxy`).
- `WEBRTC_BLOCK_ARGS`: `["--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--disable-features=WebRtcHideLocalIpsWithMdns"]` (stealth 플러그인 WebRTC 위장과 병행).
- `BASE_ARGS`: 기존 유지하되 `--single-process` 제거 재검토(프록시 컨텍스트 안정성).
- `isBlocked(resp, page)`: HTTP 429/403, 로그인·캡차 URL 리다이렉트, 캡차 마커 셀렉터, 추출 결과 빈 목록.
- `ProxyBlockedError`: crawlers 계층 전용 에러(차단/프록시 실패 신호) — 상위가 markProxyAsFailed 판단.
- `getRandomUserAgent`: UA pool을 Chromium 계열과 정합되게 점검(엔진 불일치 UA 제거).
- `toPlaywrightProxy(proxy: ProxyDoc): PlaywrightProxy` 매핑 헬퍼(`type` SOCKS → `socks5://`, 그 외 → `http://`)는 **crawlService(services)**가 소유(ProxyDoc는 services가 다룸).

### 2.5 getCookie 수정

**파일**: `crawlers/strategies/recruit/utils/getCookie.ts` (수정)

- 시그니처: `getCookie(context: BrowserContext)` 로 변경 — **호출 측이 프록시·stealth·ko-KR로 만든 context를 전달**(별도 비프록시 context 생성 제거 → 실 IP 노출 차단).
- 접속 URL: `process.env.PROXY_URL` → **`process.env.SRIA_URL`** (saramin 세션 쿠키 `XSRF-TOKEN`/`dyms_career_session` 취득 대상 정합 — 기존 버그 수정).

### 2.6 crawlService — 버그 수정 + 프록시 로테이션 오케스트레이션

**파일**: `services/crawlService.ts` (수정)

**(a) mode 버그 수정 (28행)**:
```diff
- return await getCityFilteredList(CRAWL_MODE.DUMMY, city, scraped);
+ return await getCityFilteredList(mode, city, scraped);
```
근거: CRAWL 모드에서 `getRecruitSource`가 더미 JSON 대신 `scraped`(실크롤)를 반환하도록.

**(b) 게이트·로테이션 오케스트레이션 (services 계층 소유 — §2.4 레이어 규칙)**:
`sriagent(CRAWL)`이 프록시 선택·재시도·상태전이를 담당하고 SriaCrawler엔 프록시만 주입한다. **소진 시 이벤트를 발행하지 않고 `ProxyExhaustedError`를 throw만** 한다 — 이벤트 발행 여부는 **호출자(스케줄러 vs 능동 요청)**가 결정한다(§2.9-A: 능동 요청 실패가 전체 브로드캐스트를 유발하면 안 됨).
```typescript
async sriagent(mode: CRAWL_MODE, city?: CityKo): Promise<RecruitData[] | undefined> {
  let scraped: RecruitData[] | undefined;
  if (mode === CRAWL_MODE.CRAWL) {
    scraped = await this.crawlWithProxyRotation();   // ★게이트+로테이션 (소진 시 throw)
  }
  return await getCityFilteredList(mode, city, scraped);   // (a) 버그수정
}

/** 프록시 게이트 + 세션고정·실패교체(≤3). 소진 시 ProxyExhaustedError throw (발행은 호출자). */
private async crawlWithProxyRotation(): Promise<RecruitData[]> {
  if (!(await this.proxyService.hasAvailableProxy())) {
    throw new ProxyExhaustedError("no_available_proxy", 0);
  }
  const MAX = 3;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    const proxy = await this.proxyService.getAvailableProxy();   // 세션 고정 checkout
    if (!proxy) break;
    try {
      const data = await this.sriaCrawler.crawl(toPlaywrightProxy(proxy));
      await this.proxyService.releaseProxy(proxy.ipAddress);      // 성공 → 반환
      return data;
    } catch (e) {
      await this.proxyService.markProxyAsFailed(proxy.ipAddress); // 차단/실패 → 제외
      await backoff(attempt);                                     // 지수 백오프(getDelay 지터)
    }
  }
  throw new ProxyExhaustedError("all_proxies_failed", MAX);
}
```
- `CrawlService`에 `proxyService: ProxyService` 주입(생성자). `toPlaywrightProxy`(ProxyDoc→PlaywrightProxy)·`backoff`는 services 계층 헬퍼.
- 세션당 고정: 한 attempt = 프록시 1개 고정(SriaCrawler가 그 프록시로 쿠키취득~페이지네이션 완주). 실패 시 다음 attempt에서 교체(결정: 세션 고정 + 실패 시 교체).

**(c) 발행·성공 리셋은 호출자(recruitService) 소유 (§2.9-A 정합성)**:
```typescript
// recruitService.crawlAndDiff (스케줄러 경로) — 갱신 실패 시에만 브로드캐스트 발행
try {
  const list = await this.crawler.sriagent(mode);   // 소진 시 ProxyExhaustedError
  // ... setRecruitList: 성공 시 lastRefreshedAt 기록
  //     + proxyIncident.resolve() → 있으면 RESOLVED 로그(같은 id·지속시간). 복구 DM 없음.
} catch (e) {
  if (e instanceof ProxyExhaustedError) {
    emitProxyUnavailable(e.reason, e.attempts);     // ★스케줄 갱신 실패에서만 발행
  }
  throw e;
}

// recruitService.getRecruitList Step4 (능동 경로) — 발행 없이 요청자에게만 전파
// crawled 실패(ProxyExhaustedError) → HttpError.ServiceUnavailable 로 변환해 throw
// 인터랙션 핸들러가 캐시 as-of + 안내 링크로 응답(배선은 recruitRequest phase)
```
- `emitProxyUnavailable`은 events/bus 발행 헬퍼(services→eventBus 허용). `ProxyExhaustedError`는 services 계층 에러.
- **능동 경로는 발행하지 않는다** — 한 사용자의 요청 실패가 전체 구독자 staleness 브로드캐스트를 유발하는 것을 막음.

### 2.7 ProxyScheduler 저장·검증·실패 이벤트

**파일**: `crawlers/schedulers/ProxyScheduler.ts` (수정)
```typescript
const proxyData = await this.proxyCrawler.crawl();
const verified = await filterVerifiedProxies(proxyData);      // ★저장 전 재검증
if (verified.length === 0) {
  throw SystemError.critical("ProxyScheduler", new Error("검증 통과 프록시 0건"));  // → SYSTEM_ERROR_CRITICAL
}
await new ProxyStore().saveProxyList(verified);
```
- 수집 자체 실패도 SystemError(CRITICAL)로 발행(기존 patterns). `saveProxyList`는 기존 batch 저장 재사용.

### 2.8 ProxyErrorHandler — staleness 안내 + 개발자 알림

**파일**: `events/bus/handlers/ProxyErrorHandler.ts` (신규, `NotificationSendHandler`와 동종)
**임베드**: `providers/discord/builder/embeds/proxyStalenessEmbed.ts`(사용자) · `proxyIncidentEmbed.ts`(개발자)

> 계층 근거(결정 #6): 사용자 슬래시 커맨드 없는 **이벤트 반응형 핸들러**이므로 `features/`가 아니라 `events/bus/handlers/`. DM 임베드는 기존 `notificationMessageEmbed` 컨벤션대로 `providers/discord/builder/embeds/`.

```typescript
export function registerProxyErrorHandlers(): void {
  eventBus.onEvent<ProxyUnavailableEvent>(EventType.PROXY_UNAVAILABLE, async (payload) => {
    try {
      const lastRefreshedAt = await recruitStore.getLastRefreshedAt();   // as-of

      // 1) 사용자 staleness 안내 — 갱신 안 되는 한 매 스케줄 틱 지속 발송(결정 #5).
      //    diff 없음 → 지역필터 근거 없음 → 전체 활성 구독자. 내부 원인(프록시) 비노출.
      const subs = await subscriptionStore.getAllActiveSubscribers();
      const embed = proxyStalenessEmbed(lastRefreshedAt);   // as-of + 사람인 링크(ENV.SRIA_URL)
      for (const s of subs) await sendNotificationDM(s.userId, { embeds: [embed] });

      // 2) 개발자 알림 — incident 시작 시 1회 DM. 발생/복구는 incident id로 로그 기록.
      const opened = await proxyIncident.openIfAbsent();   // 새 incident면 {id, startedAt}, 이미 열림이면 null
      if (opened) {
        crawlerLogger.error("proxy incident OPENED", undefined, { incidentId: opened.id, startedAt: opened.startedAt, reason: payload.reason });
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) await sendNotificationDM(adminId, { embeds: [proxyIncidentEmbed(payload, opened)] });   // id·발생시각 포함
      } else {
        crawlerLogger.warn("proxy incident ONGOING", { reason: payload.reason });   // 매 틱 로그(durable), DM 없음
      }
    } catch (e) {
      globalLogger.error("proxyError 알림 처리 실패", e as Error, { event: EventType.PROXY_UNAVAILABLE });
    }
  });
}
```

**임베드 내용**:
- `proxyStalenessEmbed(lastRefreshedAt)` — 사용자용. **내부 원인(프록시/크롤) 비노출**. 확정 문구:
  ```
  최신 공고를 일시적으로 갱신하지 못했어요.
  마지막 갱신: 2026-08-15 14:00 (약 8시간 전)
  최신 공고는 아래에서 확인하실 수 있어요.
  🔗 사람인 바로가기   (→ ENV.SRIA_URL)
  ```
  - 시각 = **절대 + 상대 병기** ("YYYY-MM-DD HH:mm (약 N시간 전)"). 상대값은 발송 시점에 `now - lastRefreshedAt` 계산.
- `proxyIncidentEmbed(payload, incident)` — 개발자용. 기술 상세 + **incident id·발생 시각** 포함: "🚨 프록시 소진 - 크롤링 중단. incident={id}, 발생={startedAt}, reason={reason}, attempts={attempts}".

**incident 추적**(`proxyIncident`, Redis) — **시기 구분은 DM이 아니라 로그로**(사용자 결정):
- `openIfAbsent()`: `proxy:incident` 없으면 `{ id, startedAt }` 발급·저장 후 반환(=새 장애), 이미 있으면 null. → 새 장애일 때만 **개발자 DM 1회 + OPENED 로그**.
- `resolve()`: crawlAndDiff **성공 시** 저장된 incident 반환 후 삭제, 없으면 null. → **RESOLVED 로그**(같은 id·지속시간) 기록. **복구 DM은 없음**. (§2.6-c)
- 매 틱 발생은 **ONGOING 로그**(durable)만. 사용자 staleness는 쓰로틀 없이 매 틱 지속.
- **효과**: 동일 id의 OPENED↔RESOLVED 로그 쌍으로 장애 구간을 특정 → 다른 시기 재발생은 **새 id·새 시각**이라 로그에서 명확히 구분.

**등록·발송**:
- `registerEventHandlers.ts`의 `// Phase 1.10` 자리에 `registerProxyErrorHandlers()` 연결.
- 발송은 REST `sendNotificationDM`(계약 불변). 핸들러 try-catch로 emitter 안정성(재throw 금지).

### 2.9 저하 UX 모델 (staleness)

두 서비스 경로 모두 **이전에 수집된 공고**를 서빙하므로, 갱신 실패는 "중단"이 아니라 **"신선도 저하"**로 다룬다.

**(A) 경로별 처리 — 스케줄러만 브로드캐스트 (정합성 핵심)**

| 경로 | 트리거 | 처리 |
|------|--------|------|
| **스케줄 갱신**(crawlAndDiff) | 프록시 소진 | **전체 활성 구독자에 staleness 안내** (as-of + 링크) **매 틱 지속** + **개발자 incident당 1회** → `PROXY_UNAVAILABLE` **발행 지점** |
| **능동 요청**(`/recruit-request`) | 프록시 소진(Step4) | **요청자에게만** 캐시 공고 + as-of + 안내 (HttpError→인터랙션 응답). **발행/브로드캐스트 없음** |

> ⚠️ 근거: `sriagent`는 두 경로 공용 → 무조건 발행하면 **한 사용자의 요청 실패가 전체 구독자 DM을 유발**. 그래서 발행은 스케줄러(crawlAndDiff)만.

**(B) as-of 시각**: `RecruitStore.lastRefreshedAt`(성공 크롤 저장 시 기록) → staleness 안내에 "마지막 갱신 {시각} 기준" 표기. 능동 요청은 **정상 응답에도 as-of를 함께 표기**(사용자가 신선도 인지).

**(C) 빈도**: 사용자 staleness = **갱신 안 되는 한 매 스케줄 틱 지속**(쓰로틀 없음, 결정 #5). 개발자 DM = **incident 시작 1회**. 시기 구분은 DM이 아니라 **incident id 기반 OPENED/ONGOING/RESOLVED 로그**로(§2.8) — 로그는 매 틱 durable 기록.

**(D) 스코프**: 능동 경로 UX 배선(`onRecruitRequest`는 현재 TODO 스텁)은 **recruitRequest(1.6/후속) 몫**. 1.10은 ① `ProxyExhaustedError`→`HttpError` throw 계약 ② `proxyStalenessEmbed`(재사용) ③ `lastRefreshedAt` ④ 스케줄 경로 staleness/dev 알림 까지 소유.

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조

| 컬렉션 | 문서 구조 | 용도 |
|--------|----------|------|
| `proxy/{ipAddress}` | `{ ipAddress, port, type, latency, lastCheckStatus, available, used, country?, anonymity?, verifiedAt?, failCount? }` | 검증 통과 프록시 풀 (ProxyDoc 확장) |
| `recruit/list` (기존 문서) | `{ recruitList, lastRefreshedAt }` ← **`lastRefreshedAt:number(ms)` 추가** | 성공 크롤 시각 기록 → staleness 안내 as-of |

**Redis (incident — 시기 구분·개발자 1회 DM)**: `proxy:incident` = `{ id, startedAt }`. 장애 시작 시 발급(openIfAbsent), crawlAndDiff 성공 시 삭제(resolve). OPENED/RESOLVED 로그가 같은 id를 공유해 장애 구간 특정. 사용자 알림은 매 틱 지속이라 사용자용 상태 불필요.

**ProxyDoc 확장** (`crawlers/types.ts`):
```typescript
export interface ProxyDoc extends ProxyData {
  available: boolean;   // 사용 가능(검증 통과·미차단)
  used: boolean;        // 현재 세션 checkout 여부
  country?: string;     // ip-api geo (KR 우선 정렬 키)
  anonymity?: "elite";  // verify 통과 등급
  verifiedAt?: number;  // 검증 시각(ms)
  failCount?: number;   // 누적 실패 (품질 배제 지표)
}
```

### 3.2 이벤트 페이로드

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| `PROXY_UNAVAILABLE` (신규 `"proxy:unavailable"`) | `ProxyUnavailableEvent { timestamp, source, reason, attempts, lastProxyIp? }` | **스케줄 갱신(crawlAndDiff) 프록시 소진 시에만** — 능동 요청 실패는 미발행(§2.9-A) |
| `SYSTEM_ERROR_CRITICAL` (재사용) | `SystemErrorEvent { severity:"critical", service:"ProxyScheduler", error, context }` | 프록시 수집·검증 전멸 |
| `RECRUIT_CHANGED` (기존) | `RecruitChangedEvent` | crawlAndDiff diff 발생 |

**types.ts 추가**:
```typescript
// enum
PROXY_UNAVAILABLE = "proxy:unavailable",
// payload
export interface ProxyUnavailableEvent extends BaseEvent {
  reason: "no_available_proxy" | "all_proxies_failed";
  attempts: number;
  lastProxyIp?: string;
}
// EventPayloadMap
[EventType.PROXY_UNAVAILABLE]: ProxyUnavailableEvent;
```

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 |
|------|------|------|----------|
| 1 | crawlService mode 버그 수정 (독립·저위험) | `services/crawlService.ts` | §2.6 |
| 2 | ProxyDoc 확장 + `PROXY_UNAVAILABLE` 이벤트 타입 | `crawlers/types.ts`, `events/bus/types.ts` | §3 |
| 3 | ProxyStore 상태 메서드 + **RecruitStore `lastRefreshedAt`** | `providers/firebase/store/proxy.ts`, `recruit.ts` | §2.1, §3.1 |
| 4 | ProxyService 5메서드 + export | `services/proxyService.ts`, `services/index.ts` | §2.2 |
| 5 | verifyProxy 코어 + CLI 스크립트 | `crawlers/utils/verifyProxy.ts`, `scripts/verifyProxy.ts` | §2.3 |
| 6 | getCookie 프록시·URL 정합 | `crawlers/strategies/recruit/utils/getCookie.ts` | §2.5 |
| 7 | SriaCrawler 프록시 주입 executor(차단감지·WebRTC) | `crawlers/strategies/recruit/sria/SriaCrawler.ts` | §2.4 |
| 7b | crawlService 로테이션(소진 시 throw) + recruitService 발행·리셋 | `services/crawlService.ts`, `recruitService.ts` | §2.6, §2.9 |
| 8 | ProxyScheduler 저장·검증·실패 이벤트 | `crawlers/schedulers/ProxyScheduler.ts` | §2.7 |
| 9 | ProxyErrorHandler + 임베드 2종 + 등록 | `events/bus/handlers/ProxyErrorHandler.ts`, `providers/discord/builder/embeds/proxy*Embed.ts`, `events/bus/utils/registerEventHandlers.ts` | §2.8 |
| 10 | License/Compliance 재확인 (실 CRAWL 전) | — | plan §리스크 |

> 능동 경로(`/recruit-request`) staleness UX 배선은 **1.10 범위 밖**(recruitRequest 1.6/후속). 1.10은 재사용 산출물(임베드·lastRefreshedAt·throw 계약)만 준비 (§2.9-D).

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger(providerLogger/crawlerLogger) 사용 (console.log 금지)
- [ ] SystemError 팩토리 패턴 준수 (SYSTEM_ERROR_* 자동 발행)
- [ ] EventBus 타입 안전 이벤트 (제네릭 `emitEvent<T>`/`onEvent<T>`)
- [ ] provider→services/features 참조 금지, services→providers 허용
- [ ] dmSender 계약(DmPayload/DmSendResult) 불변
- [ ] JSDoc 주석(public API) + 한국어 주석

---

## 6. 테스트 계획

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 타입/컴파일 | `npx tsc --noEmit` | 새 에러 0 |
| **(C)** IP 우회 | `tsx scripts/verifyProxy.ts` | 프록시 경유 IP ≠ 직접 IP, elite·country 출력 |
| **(C)** verify 필터 | `filterVerifiedProxies` 단위 | transparent/HTTP-only/dead 배제 |
| **(C)** crawlService 버그 | CRAWL 모드 sriagent 결과 | 더미 아닌 scraped 반환 (mock) |
| 로테이션 로직 | markProxyAsFailed 후 재선택 | 다른 프록시 checkout, ≤3회 |
| staleness 알림 | 스케줄 소진 시 PROXY_UNAVAILABLE | 구독자 as-of+링크 매 틱 / 개발자 1회 (emulator) |
| 브로드캐스트 격리 | 능동 요청 소진 | HttpError만, 전체 구독자 DM 미발생 |
| incident 구분 | 크롤 성공(resolve) 후 재소진 | 새 id·시각 발급 → 개발자 재알림 + OPENED/RESOLVED 로그쌍 |
| **(U)** 실 CRAWL·배포 E2E | GCP 배포 후 스케줄 주기 | 크롤→diff→DM 완결 (R4/R5/DM분기/부하/로그) |

---

*작성일: 2026-08-15*
*참고: docs/phase-1-10/01-plan.md*

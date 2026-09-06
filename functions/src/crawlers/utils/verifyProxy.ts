import "@/common/utils/systemLogger";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright-core";
import type { ProxyData, ProxyDoc, PlaywrightProxy } from "@/crawlers/types";

/**
 * 프록시 1개 검증 결과. (Phase 1.10)
 */
export interface ProxyVerifyResult {
  /** liveness — 검증 요청이 프록시를 통해 성립했는지. */
  ok: boolean;
  /** elite 여부 — 대상이 본 origin이 프록시 IP 단일 + XFF/Via/X-Real-IP 누수 없음. */
  elite: boolean;
  /** 대상이 본 origin IP. */
  proxyIp?: string;
  /** ip-api geo 국가코드 (예: "KR"). */
  country?: string;
  /** HTTPS(CONNECT) 또는 SOCKS 터널 성립 여부. */
  protocolOk: boolean;
  /** 검증 왕복 지연(ms). */
  latencyMs: number;
}

/** 검증 임계값. */
const VERIFY_TIMEOUT_MS = 10_000;
const MAX_LATENCY_MS = 8_000;
const VERIFY_CONCURRENCY = 8;

/** IP 에코·헤더·geo 엔드포인트. */
const IP_ECHO_URL = "https://httpbin.org/ip";
const HEADERS_URL = "https://httpbin.org/headers";
const GEO_URL = "http://ip-api.com/json";

/** 실 IP 누수를 드러내는 헤더들 — 존재하면 transparent(비-elite). */
const LEAK_HEADERS = ["X-Forwarded-For", "Via", "X-Real-Ip", "Forwarded", "Client-Ip"];

let stealthApplied = false;

/**
 * `ProxyData.type`을 Playwright `proxy.server` 스킴으로 매핑한다. (Phase 1.10)
 *
 * SOCKS 계열은 `socks5://`, 그 외(HTTP/HTTPS)는 `http://`.
 * crawlService(services)도 이 헬퍼를 재사용한다(crawlers/utils는 하위 계층).
 */
export function toProxyServer(proxy: ProxyData): PlaywrightProxy {
  const isSocks = (proxy.type ?? "").toUpperCase().includes("SOCKS");
  const scheme = isSocks ? "socks5" : "http";
  return { server: `${scheme}://${proxy.ipAddress}:${proxy.port ?? ""}` };
}

/** 프록시 context로 URL을 열어 JSON 본문을 파싱한다(실패 시 null). */
async function fetchJson<T>(browser: Browser, proxy: PlaywrightProxy, url: string): Promise<T | null> {
  const context = await browser.newContext({ proxy });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: VERIFY_TIMEOUT_MS });
    const body = await page.evaluate(() => document.body.innerText);
    return JSON.parse(body) as T;
  } catch {
    return null;
  } finally {
    await context.close();
  }
}

/** 단일 브라우저를 재사용해 프록시 1개를 검증한다. */
async function verifyProxyWith(browser: Browser, proxy: ProxyData): Promise<ProxyVerifyResult> {
  const server = toProxyServer(proxy);
  const startedAt = Date.now();

  const ipRes = await fetchJson<{ origin: string }>(browser, server, IP_ECHO_URL);
  const latencyMs = Date.now() - startedAt;

  if (!ipRes?.origin) {
    return { ok: false, elite: false, protocolOk: false, latencyMs };
  }

  // origin이 콤마로 여러 IP면 체이닝 노출 → 비-elite 신호.
  const proxyIp = ipRes.origin.split(",")[0].trim();
  const singleOrigin = !ipRes.origin.includes(",");

  const headersRes = await fetchJson<{ headers: Record<string, string> }>(browser, server, HEADERS_URL);
  const headerKeys = Object.keys(headersRes?.headers ?? {}).map((k) => k.toLowerCase());
  const noLeak = !LEAK_HEADERS.some((h) => headerKeys.includes(h.toLowerCase()));

  const geoRes = await fetchJson<{ countryCode?: string }>(browser, server, GEO_URL);

  return {
    ok: true,
    protocolOk: true, // HTTPS(httpbin) 요청이 성립 = CONNECT/SOCKS 터널 정상.
    elite: singleOrigin && noLeak,
    proxyIp,
    country: geoRes?.countryCode,
    latencyMs,
  };
}

/**
 * 프록시 1개를 IP 에코로 검증한다(실 사람인 크롤 없음, 부작용 0). (Phase 1.10)
 * 독립 브라우저를 띄워 검증 후 종료 — CLI/단위 검증용.
 */
export async function verifyProxy(proxy: ProxyData): Promise<ProxyVerifyResult> {
  if (!stealthApplied) {
    chromium.use(stealth());
    stealthApplied = true;
  }
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  });
  try {
    return await verifyProxyWith(browser, proxy);
  } finally {
    await browser.close();
  }
}

/**
 * 프록시 목록을 검증해 통과분만 ProxyDoc으로 반환한다. (Phase 1.10)
 *
 * 통과 조건: ok && elite && protocolOk && latency < 임계. country는 정렬 키로 보존.
 * ProxyScheduler가 저장 직전에 호출한다. 단일 브라우저 + 제한 동시성으로 실행.
 */
export async function filterVerifiedProxies(list: ProxyData[]): Promise<ProxyDoc[]> {
  if (list.length === 0) return [];

  if (!stealthApplied) {
    chromium.use(stealth());
    stealthApplied = true;
  }
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    headless: true,
  });

  const verified: ProxyDoc[] = [];
  try {
    // 제한 동시성 청크 처리.
    for (let i = 0; i < list.length; i += VERIFY_CONCURRENCY) {
      const chunk = list.slice(i, i + VERIFY_CONCURRENCY);
      const results = await Promise.all(
        chunk.map(async (proxy) => ({ proxy, result: await verifyProxyWith(browser, proxy) }))
      );
      for (const { proxy, result } of results) {
        if (result.ok && result.elite && result.protocolOk && result.latencyMs < MAX_LATENCY_MS) {
          verified.push({
            ...proxy,
            available: true,
            used: false,
            country: result.country,
            anonymity: "elite",
            verifiedAt: Date.now(),
            failCount: 0,
          });
        }
      }
    }
    globalLogger.info(`[verifyProxy] ${verified.length}/${list.length} proxies passed verification.`);
    return verified;
  } finally {
    await browser.close();
  }
}

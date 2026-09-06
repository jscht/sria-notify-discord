import "@/common/utils/systemLogger";
import { BaseCrawler } from "../../base/BaseCrawler";
import type { RecruitData, PlaywrightProxy } from "@/crawlers/types";
import { ProxyBlockedError } from "@/crawlers/errors";
import {
  extractRecruitData,
  getCookie,
  getPaginationItemCount,
  isNextPageAvailable
} from "../utils";
import { getRandomUserAgent, getDelay } from "@/crawlers/utils";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import type { Page, Response } from "playwright-core";

/** 공통 launch args (기존 유지). */
const BASE_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
];

/**
 * WebRTC 실 IP 누수 차단 args (Phase 1.10).
 * 프록시를 우회한 non-proxied UDP(STUN)로 실 IP가 새는 것을 막는다.
 * stealth 플러그인의 WebRTC 위장과 병행.
 */
const WEBRTC_BLOCK_ARGS = [
  "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  "--disable-features=WebRtcHideLocalIpsWithMdns",
];

let stealthApplied = false;

/**
 * 응답·페이지에서 차단 신호를 감지한다. (Phase 1.10)
 * HTTP 429/403, 로그인·캡차·블록 페이지 리다이렉트.
 */
function isBlocked(resp: Response | null, page: Page): boolean {
  const status = resp?.status();
  if (status === 429 || status === 403) return true;

  const url = page.url().toLowerCase();
  return ["login", "captcha", "block"].some((marker) => url.includes(marker));
}

/**
 * 사람인(SRIA) 채용공고 크롤러. (Phase 1.10: 프록시 주입 단일 executor)
 *
 * 게이트·로테이션·상태전이 오케스트레이션은 crawlService(services)가 소유하고,
 * 본 executor는 **주입받은 프록시로 1회 시도만** 수행한다(crawlers→services 무참조).
 * 차단 감지 시 `ProxyBlockedError`를 throw해 상위가 로테이션을 판단한다.
 */
export class SriaCrawler extends BaseCrawler {
  async crawl(proxy: PlaywrightProxy): Promise<RecruitData[]> {
    if (!stealthApplied) {
      chromium.use(stealth());
      stealthApplied = true;
    }

    const browser = await chromium.launch({
      args: [...BASE_ARGS, ...WEBRTC_BLOCK_ARGS],
      headless: true,
    });

    try {
      const context = await browser.newContext({
        proxy,
        userAgent: getRandomUserAgent(),
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
        extraHTTPHeaders: {
          "Accept-Language": "ko-KR,ko;q=0.9",
          "Cache-Control": "no-cache",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      // 쿠키 취득도 프록시 context로 수행 (실 IP 노출 차단).
      const cookies = await getCookie(context);
      if (!cookies) {
        throw new Error("Missing required cookies");
      }
      await context.addCookies(cookies);

      const page = await context.newPage();
      const targetUrl = `${process.env.SRIA_URL}`;
      const resp = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: getDelay(2),
      });

      if (isBlocked(resp, page)) {
        throw new ProxyBlockedError();
      }

      const recruitData = await this.collectPages(page);
      await context.close();
      return recruitData;
    } finally {
      await browser.close();
    }
  }

  /**
   * 페이지네이션을 돌며 공고를 수집한다. 요청 간 jitter로 봇 패턴을 완화한다.
   */
  private async collectPages(page: Page): Promise<RecruitData[]> {
    const recruitData: RecruitData[] = [];
    const totalPages = await getPaginationItemCount(page);
    globalLogger.info(`[SriaCrawler] Total pages: ${totalPages}`);

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      const extractedData = await extractRecruitData(page);

      if (!extractedData || extractedData.length === 0) {
        globalLogger.warn("[SriaCrawler] No recruitment data found.");
        break;
      }

      recruitData.push(...extractedData);

      const delay = getDelay(2, 3);
      await page.waitForTimeout(delay);

      if (currentPage < totalPages) {
        const { nextPageButton, hasNextPage } = await isNextPageAvailable(page);
        if (!hasNextPage) {
          globalLogger.info("[SriaCrawler] Next page does not exist.");
          break;
        }

        await Promise.all([
          nextPageButton.click(),
          page.waitForLoadState("domcontentloaded"),
        ]);
      }
    }

    return recruitData;
  }
}

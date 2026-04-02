import "@/common/utils/systemLogger";
import { Page } from "playwright-core";
import { BaseCrawler } from "../base/BaseCrawler";
import type { ProxyData } from "@/crawlers/types";
import { getRandomUserAgent, getDelay } from "@/crawlers/utils";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

/**
 * 프록시 정보 크롤러
 */
export class ProxyCrawler extends BaseCrawler {
  async crawl(): Promise<ProxyData[]> {
    chromium.use(stealth());

    const browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      headless: true,
    });

    try {
      const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
      });

      const page = await context.newPage();
      const targetUrl = `${process.env.PROXY_URL}`;

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: getDelay(7),
      });

      const proxyData = await this.extractProxyList(page);

      globalLogger.info(`[ProxyCrawler] Collected ${proxyData.length} proxies.`);

      await context.close();
      return proxyData;
    } catch (error) {
      globalLogger.error("[ProxyCrawler] Crawling failed", error as Error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * 페이지에서 프록시 목록 추출
   */
  private async extractProxyList(page: Page): Promise<ProxyData[]> {
    const proxyRows = await page.locator("tr[onmouseover]").all();

    const proxyList = await Promise.all(
      proxyRows.map(async (row) => {
        const ipElement = row.locator("td:nth-child(1) font.spy14");
        const proxyTypeElement = row.locator("td:nth-child(2)");
        const latencyElement = row.locator("td:nth-child(6) font.spy1");
        const statusElement = row.locator("td:nth-child(8) acronym");

        const [endpoint, type, latency, status] = await Promise.all([
          ipElement.innerText().catch(() => null),
          proxyTypeElement.innerText().catch(() => null),
          latencyElement.innerText().catch(() => "Infinity"),
          statusElement.getAttribute("title").catch(() => null),
        ]);

        const [ipAddress, port] = (endpoint || ":").split(":");

        return {
          ipAddress,
          port: port ? parseInt(port) : null,
          type,
          latency: parseFloat(latency),
          lastCheckStatus: status ? status.split("=")[1] : null,
          available: true,
          used: false,
        } as ProxyData;
      })
    );

    // 상태가 OK인 프록시만 필터링하고 지연시간 순으로 정렬
    return proxyList
      .filter(({ lastCheckStatus }) => lastCheckStatus === "OK")
      .sort((a, b) => a.latency - b.latency);
  }
}

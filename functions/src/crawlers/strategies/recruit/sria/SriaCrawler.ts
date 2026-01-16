import "@/common/utils/logger";
import { BaseCrawler } from "../../base/BaseCrawler";
import type { RecruitData } from "@/crawlers/types";
import { 
  extractRecruitData, 
  getCookie, 
  getPaginationItemCount, 
  isNextPageAvailable 
} from "../utils";
import { getRandomUserAgent, getDelay } from "@/crawlers/utils";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

/**
 * 사람인(SRIA) 채용공고 크롤러
 */
export class SriaCrawler extends BaseCrawler {
  async crawl(): Promise<RecruitData[]> {
    chromium.use(stealth());

    const browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      headless: true,
    });

    try {
      const cookies = await getCookie(browser);
      if (!cookies) {
        throw new Error("Missing required cookies");
      }

      const context = await browser.newContext({
        userAgent: getRandomUserAgent(),
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      context.addCookies(cookies);

      const page = await context.newPage();
      const targetUrl = `${process.env.SRIA_URL}`;

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: getDelay(2),
      });

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

      await context.close();
      return recruitData;
    } catch (error) {
      throw error;
    } finally {
      await browser.close();
    }
  }
}

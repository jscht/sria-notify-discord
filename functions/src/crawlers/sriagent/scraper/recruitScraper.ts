import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { ResponseRecruitData } from "../../../types/responseRecruitData";
import { extractRecruitData } from "./extractRecruitData";
import { isNextPageAvailable } from "./isNextPageAvailable";
import { getPaginationItemCount } from "./getPaginationItemCount";
import { getDelay } from "../../../utils/getDelay";
import { getCookie } from "./getCookie";
import { proxyScraper } from "../../proxy";
import { getRandomUserAgent } from "../../../utils/getRandomUserAgent";

export async function recruitScraper() {
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
  })
  .catch((error) => {
    throw error;
  });

  const cookies = await getCookie(browser);

  if (!cookies) {
    throw new Error("Missing one or more required cookies");
  }

  // redis에서 proxyList 확인
  // get redis proxy list
  // const proxyList = await proxyScraper();

  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
    },
    proxy: { server: "" } // proxy address
  })
  .catch((error) => {
    throw error;
  });

  context.addCookies(cookies);

  try {
    const page = await context.newPage();

    const targetUrl = `${process.env.SRI_URL}`;
    const pageWaitDelay = getDelay(7);

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: pageWaitDelay
    })

    const recruitData: ResponseRecruitData[] = [];
    const totalPages = await getPaginationItemCount(page);
    DebugLogger.server(`total page: ${totalPages.toString()}`);

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      const extractRecruitList = await extractRecruitData(page);

      if (!extractRecruitList || extractRecruitList.length === 0) {
        DebugLogger.warn("No recruitment data found.");
        break;
      }

      recruitData.push(...extractRecruitList);

      const delay = getDelay(3, 5);
      DebugLogger.server(`Waiting for ${delay}ms...`);
      await page.waitForTimeout(delay);

      // 다음 페이지로 이동
      if (currentPage < totalPages) {
        const { nextPageButton, hasNextPage } = await isNextPageAvailable(page);
        if (!hasNextPage) {
          DebugLogger.server("Next page does not exist.");
          break;
        }

        await Promise.all([
          nextPageButton.click(),
          page.waitForLoadState("domcontentloaded"),
        ]);
      }
    }

    return recruitData;
  } catch (error) {
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

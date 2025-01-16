import playwright from "playwright";
import { ResponseRecruitData } from "../../../types/responseRecruitData";
import { extractRecruitData } from "./extractRecruitData";
import { isNextPageAvailable } from "./isNextPageAvailable";
import { getPaginationItemCount } from "./getPaginationItemCount";

// 1초 ~ 3초 딜레이
function getDelay() {
  const min = 1000;
  const max = 3000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function recruitScraper() {
  const browser = await playwright.chromium.launch({
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
    const page = await browser.newPage();

    await page.route("**/*", (route, request) => {
      if (request.resourceType() === "image" ||
        request.resourceType() === "stylesheet" ||
        request.resourceType() === "font") {
        route.abort();
      } else {
        route.continue();
      }
    });

    const targetUrl = `${process.env.SRI_URL}/jobs/`;
    await page.goto(targetUrl, { 
      waitUntil: "load",
      timeout: 10 * 1000
    });

    const recruitData: ResponseRecruitData[] = [];
    const totalPages = await getPaginationItemCount(page);
    DebugLogger.server(`total page: ${totalPages.toString()}`);

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.time("scraping");
      const extractRecruitList = await extractRecruitData(page);
      console.timeEnd("scraping");

      if (!extractRecruitList || extractRecruitList.length === 0) {
        DebugLogger.warn("No recruitment data found.");
        break;
      }

      recruitData.push(...extractRecruitList);

      const delay = getDelay();
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
          page.waitForLoadState("load"),
        ]);
      }
    }

    return recruitData;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error during scraping:", error);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

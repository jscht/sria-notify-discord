import playwright from "playwright";
import { ResponseRecruitData } from "../../types/responseRecruitData";
import { extractRecruitData } from "./extractRecruitData";
import { isNextPageAvailable } from "./isNextPageAvailable";

export async function recruitScraper() {
  const browser = await playwright.chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });

  try {
    const page = await browser.newPage();

    const targetUrl = `${process.env.SRI_URL}/jobs/`;
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    const recruitData: ResponseRecruitData[] = [];

    while(true) {
      console.time("scraping");
      const extractRecruitList = await extractRecruitData(page);
      console.timeEnd("scraping");

      if (!extractRecruitList || extractRecruitList.length === 0) {
        DebugLogger.warn("No recruitment data found.");
        break;
      }

      recruitData.push(...extractRecruitList);

      const { nextPageButton, hasNextPage } = await isNextPageAvailable(page);
      if (!hasNextPage) {
        DebugLogger.server("Next page does not exist.");
        break;
      }

      await Promise.all([
        nextPageButton.click(),
        page.waitForLoadState("networkidle")
      ]);
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
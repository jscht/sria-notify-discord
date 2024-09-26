import { chromium } from "playwright";
import { logger } from "firebase-functions";
import { City } from "../../types/city.d";
import { ResponseRecruitData } from "../../types/responseRecruitData.d";
import { getFilteredRecruitData } from "./getFilteredRecruitData";
import { isNextPageAvailable } from "./isNextPageAvailable";

export async function requestCrawling(city?: City) {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();

    const targetUrl = `${process.env.SRI_URL}/jobs/`;
    
    await Promise.all([
      page.goto(targetUrl as string, { waitUntil: "load" }),
      page.waitForSelector('.v-data-iterator.recruit_list ul > li')
    ])

    const allExtractedData: ResponseRecruitData[] = [];

    let hasNextPage = true;

    while(hasNextPage) {
      console.time("extractedCrawlData");

      const extractedRecruitList = await getFilteredRecruitData(page, city);
      console.timeEnd("extractedCrawlData");

      if (!extractedRecruitList || extractedRecruitList.length === 0 || extractedRecruitList[0] === null) {
        logger.warn("No recruitment data found.");
        break;
      }

      // null 값 필터링
      const filteredRecruitList = extractedRecruitList.filter((item): item is ResponseRecruitData => item !== null);
      allExtractedData.push(...filteredRecruitList);

      const nextPageButton = page.locator('[aria-label="다음 페이지"].v-pagination__navigation');

      hasNextPage = await isNextPageAvailable(nextPageButton);
      if (!hasNextPage) {
        logger.info("Next page button is disabled.");
        break;
      }

      await Promise.all([
        nextPageButton.click(),
        page.waitForSelector('.v-data-iterator.recruit_list ul > li')
      ]);
    }

    return allExtractedData;
  } catch (error) {
    console.error("Error during crawling:", error);
    throw error;
  } finally {
    await browser.close();
  }
};
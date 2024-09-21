import { chromium, Locator, Page } from "playwright";
import { City } from "./types/city";

export async function requestCrawling(city?: City) {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();

    const targetUrl = `${process.env.SRI_URL}/jobs/`;
    await page.goto(targetUrl as string, { waitUntil: "domcontentloaded" });

    const extractedCrawlData = await extractData(page, city);

    return extractedCrawlData;
  } catch (error) {
    console.error("Error during crawling:", error);
    throw error;
  } finally {
    await browser.close();
  }
};

async function extractData(crawlData: Page, city?: City) {
  // const nextPageButton = crawlData.locator('[aria-label="다음 페이지"].v-pagination__navigation');
  // if (!isNextPageAvailable(nextPageButton)) {
    // 다음 페이지 없음
  // }
  // 다음 페이지 가능


  console.log(crawlData);
  return crawlData;
};

async function isNextPageAvailable(nextPageButton: Locator) {
  const isDisabled = await nextPageButton.evaluate((element) => 
    element.classList.contains('v-pagination__navigation--disabled')
  );
  return !isDisabled ? true : false;
}

async function extractRecruitData(page: Page) {
  const recruitListItems = await page.$$(
    '.v-data-iterator.recruit_list ul > li'
  );
  
  for (const item of recruitListItems) {
    // recruit_tit 클래스 요소 안의 a 태그 내의 class=inner 자식 요소의 href와 텍스트 가져오기
    const recruitTitElement = await item.$('.recruit_tit a .inner');
    const href = await recruitTitElement?.getAttribute('href');
    const title = await recruitTitElement?.textContent();
  
    // day_box 클래스 안의 d_day, day_txt 요소의 텍스트 가져오기
    const dayBoxElement = await item.$('.recruit_tit .day_box');
    const dDay = await dayBoxElement?.$eval('.d_day', el => el.textContent);
    const dayTxt = await dayBoxElement?.$eval('.day_txt', el => el.textContent);
  
    // recruit_badge 클래스 안의 badge_ing 요소의 텍스트 가져오기
    const recruitmentStatus = await item.$eval('.recruit_badge em', el => el.textContent);
  
    return {
      href,
      title,
      dDay,
      dayTxt,
      recruitmentStatus
    }
  }
}

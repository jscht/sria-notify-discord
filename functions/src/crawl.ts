import { chromium, Locator, Page } from "playwright";
import { logger } from "firebase-functions";
import { City } from "./types/city";
import recruitList from "./constants/recruit_list.json";

export async function requestDummyData(city?: City) {
  try {
    if (!city) {
      return recruitList;
    }
    return recruitList.filter((job) => job.title.includes(city));
  } catch (error) {
    logger.error("더미데이터 반환 실패");
    return new Error("더미데이터 에러");
  }
}

type ResponseRecruitData = {
  href: string, 
  title: string, 
  dDay: string, 
  dayTxt: string, 
  recruitmentStatus: string
}

async function requestCrawling(city?: City) {
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

      const extractedRecruitList = await extractData(page, city);
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

async function extractData(crawlData: Page, city?: City) {
  const result = await extractRecruitData(crawlData);
  if (!city) {
    return result;
  }
  else return result.filter((job) => job?.title?.includes(city));
};

async function isNextPageAvailable(nextPageButton: Locator) {
  const isDisabled = await nextPageButton.evaluate((element) => 
    element.classList.contains('v-pagination__navigation--disabled')
  );
  return !isDisabled ? true : false;
}

async function extractRecruitData(page: Page) {
  const recruitListItem = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('.v-data-iterator.recruit_list ul > li'));

    const list = elements.map((item) => {
      // recruit_tit 클래스 요소 안의 class=inner 자식 요소의 href와 텍스트 가져오기
      const recruitTitElement = item.querySelector<HTMLElement>('.recruit_tit .inner');
      if (!recruitTitElement) {
        return null;
      }
      const href = recruitTitElement.getAttribute('href') || '';
      const title = recruitTitElement.innerText || '';
    
      // day_box 클래스 안의 d_day, day_txt 요소의 텍스트 가져오기
      const dayBoxElement = item.querySelector('.recruit_tit .day_box');
      if (!dayBoxElement) {
        return null;
      }
      const dDay = dayBoxElement.querySelector('.d_day')?.textContent || '';
      const dayTxt = dayBoxElement.querySelector('.day_txt')?.textContent || '';
    
      // recruit_badge 클래스 안의 em 요소의 텍스트 가져오기
      const recruitmentStatus = item.querySelector('.recruit_badge em')?.textContent || '';
    
      return { href, title, dDay, dayTxt, recruitmentStatus } as ResponseRecruitData;
    });

    return list[0] !== null ? list : [];
  });

  return recruitListItem;
}

import { Page } from "playwright";
import { ResponseRecruitData } from "../../types/responseRecruitData";

export async function extractRecruitData(page: Page) {
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

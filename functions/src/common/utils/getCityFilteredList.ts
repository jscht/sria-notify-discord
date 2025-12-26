/**
 * City Filtered List Utility
 * 도시별로 공고 목록을 필터링
 */

export interface RecruitDataBase {
  title: string;
  [key: string]: any;
}

export enum CrawlModeEnum {
  DUMMY = "dummy",
  CRAWL = "crawl"
}

export async function getCityFilteredList(
  mode: string, 
  city?: string, 
  recruitList?: RecruitDataBase[]
): Promise<RecruitDataBase[]> {
  let list: RecruitDataBase[];

  if (mode === CrawlModeEnum.DUMMY) {
    // TODO: 더미 데이터 경로 수정 필요
    // 순환 참조를 피하기 위해 동적 require 사용
    try {
      const dummyList = require("@/mocks/crawlers/sample-recruit-list.json");
      list = dummyList as RecruitDataBase[];
    } catch {
      list = [];
    }
  } else {
    if (!Array.isArray(recruitList)) {
      throw new Error("recruitList is required in CRAWL mode.");
    }
    list = recruitList;
  }

  if (!city) {
    return list;
  }

  return list.filter(({ title }) => title.includes(city));
}

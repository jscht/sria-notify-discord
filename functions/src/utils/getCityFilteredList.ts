import { CityEn, CityKo } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import dummyList from "../test/mocks/sriagent/sample-recruit-list.json";
import { CRAWL_MODE } from "../constants/crawlMode";

export async function getCityFilteredList(
  mode: CRAWL_MODE, 
  city?: CityEn | CityKo, 
  recruitList?: ResponseRecruitData[]
) {
  let list: ResponseRecruitData[];

  if (mode === CRAWL_MODE.DUMMY) {
    list = dummyList as ResponseRecruitData[];
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
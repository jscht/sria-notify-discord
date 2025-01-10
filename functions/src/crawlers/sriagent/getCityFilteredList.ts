import { CityEn, CityKo } from "../../types/city";
import { ResponseRecruitData } from "../../types/responseRecruitData";
import dummyList from "./dummyData/recruit_list.json";
import { CRAWL_MODE } from "../../constants/crawlMode";

export async function getCityFilteredList(mode: CRAWL_MODE, city?: CityEn | CityKo, recruitList?: ResponseRecruitData[]) {
  if (mode === CRAWL_MODE.CRAWL && !recruitList) throw new Error("recruitList is empty");
  
  const list = mode === CRAWL_MODE.DUMMY ? dummyList : recruitList;
  
  if (!city) {
    return list as ResponseRecruitData[];
  }
  return list!.filter(({ title }) => title.includes(city)) as ResponseRecruitData[];
}

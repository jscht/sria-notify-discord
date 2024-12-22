import { CityKo } from "../../types/city";
import { ResponseRecruitData } from "../../types/responseRecruitData.d";
import recruitList from "../../constants/recruit_list.json";

export async function requestDummyData(city?: CityKo) {
  const recruitDataList = recruitList as ResponseRecruitData[];
  if (!city) {
    return recruitDataList;
  }
  return recruitDataList.filter((job) => job.title.includes(city));
}

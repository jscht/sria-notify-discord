import { City } from "../../types/city";
import { ResponseRecruitData } from "../../types/responseRecruitData.d";
import recruitList from "../../constants/recruit_list.json";

export async function requestDummyData(city?: City) {
  const recruitDataList: ResponseRecruitData[] = recruitList;
  if (!city) {
    return recruitDataList;
  }
  return recruitDataList.filter((job) => job.title.includes(city));
}

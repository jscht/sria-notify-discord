import { logger } from "firebase-functions";
import { City } from "../../types/city";
import recruitList from "../../constants/recruit_list.json";

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

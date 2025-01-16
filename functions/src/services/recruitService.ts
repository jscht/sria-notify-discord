import { crawlService } from "./crawlService";
import { CRAWL_MODE } from "../constants/crawlMode";
import { isValidCityName } from "../utils/isValidCityName";
import { HttpError } from "../utils/httpError";
import { cityNameConverter } from "../utils/cityNameConverter";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { getRedisInstance } from "../providers/redis";
import { getCityFilteredList } from "../crawlers/sriagent";
import { ResponseRecruitData } from "../types/responseRecruitData";



export const recruitServices = async function(mode: CRAWL_MODE, city?: any) {
  const redisInstance = getRedisInstance();

  try {
    // check city
    if (city && !isValidCityName(city)) {
      DebugLogger.warn("Invalid cityName");
      throw HttpError.BadRequest("Invalid cityName");
    }

    // check redis cache
    const cachedRecruitHash = await redisInstance.getHashDataFromRedis();

    if (cachedRecruitHash !== null) {
      DebugLogger.server("Returning cached recruit list");
      const cachedRecruitList: ResponseRecruitData[] =
        Object.values(cachedRecruitHash).map((value) => JSON.parse(value));
      return getCityFilteredList(mode, cityNameConverter.toKorean(city), cachedRecruitList);
    }

    // check firestore
    const recruitFS = new RecruitFireStore();
    const firestoreRecruitList = await recruitFS.getRecruitList();

    if (firestoreRecruitList && Object.keys(firestoreRecruitList).length > 0) {
      const firestoreList = firestoreRecruitList.recruitList as ResponseRecruitData[];

      // redis cache renewal
      DebugLogger.server("Cache updated in Redis with new recruit list from Firestore.");
      redisInstance.setToRedis(firestoreList);

      DebugLogger.server("Returning Firestore recruit list");
      return getCityFilteredList(mode, cityNameConverter.toKorean(city), firestoreList);
    }

    // request crawling
    // 크롤링 요청이 과할 경우 무시하는 로직 추가 (redis, firestore 둘 다 장애 시)
    const crawlData = await crawlService(mode, cityNameConverter.toKorean(city));
    if (!crawlData) {
      DebugLogger.error("Failed to retrieve data from crawling service");
      throw HttpError.ServiceUnavailable();
    }

    DebugLogger.server("Returning crawl data");
    return getCityFilteredList(mode, cityNameConverter.toKorean(city), crawlData);
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error in recruitServices:", error);
    }
    throw error;
  }
};

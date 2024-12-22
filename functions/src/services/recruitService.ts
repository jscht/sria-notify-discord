import { crawlService } from "./crawlService";
import { CRAWL_MODE } from "../constants/crawlMode";
import { isValidCityName } from "../utils/isValidCityName";
import { HttpError } from "../utils/httpError";
import { cityNameConverter } from "../utils/cityNameConverter";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { getRedisInstance } from "../providers/redis";

// 4시간에 한 번 모집 내역 패치하는 로직으로! (시간 확인하는 부분 중요함!)
// 캐시, 데이터베이스 확인 (캐시 확인 -> 파베 디비 확인(디비에 없으면 바로 패치))

// 서버 렘에 더미데이터, 연결 확인 시간 데이터를 캐시로..
// 데이터베이스엔 클라이언트 데이터가 없을 때 서버가 받아와 놓은 데이터 활용 -> 4시간에 한번 크롤링 데이터 패치

export const recruitServices = async function(city?: any) {
  const redisInstance = getRedisInstance();

  try {
    // check city
    if (city && !isValidCityName(city)) {
      DebugLogger.warn("Invalid cityName");
      throw HttpError.BadRequest("Invalid cityName");
    }
  
    // check redis cache
    const cachedRecruitList = redisInstance.getFromRedis("recruit:list", cityNameConverter.toEnglish(city));
    if (!cachedRecruitList) {
      // string 값인 캐시 가공 로직 추가
      DebugLogger.server("Returning cached recruit list");
      return cachedRecruitList;
    }
  
    // check firestore
    const recruitFS = new RecruitFireStore();
    // DocumentData 타입으로 오기 때문에 데이터 가공 필요
    const firestoreRecruitList = recruitFS.getRecruitList();
  
    if (firestoreRecruitList) {
      DebugLogger.server("Returning Firestore recruit list");
      // type Promise<DocumentData | null> -> ResponseRecruitData[]로 되도록
      // redisInstance.setToRedis("recruit:list", firestoreRecruitList);
      return firestoreRecruitList;
    }
  
    // 크롤링 요청이 과할 경우 무시하는 로직 추가 (redis, firestore 둘 다 장애 시)
    const crawlData = crawlService(CRAWL_MODE.DUMMY, cityNameConverter.toKorean(city));
    if (!crawlData) {
      DebugLogger.error("Failed to retrieve data from crawling service");
      throw HttpError.ServiceUnavailable();
    }
  
    DebugLogger.server("Returning crawl data");
    return crawlData;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error('Error in recruitServices:', error);
    }
    throw error;
  }
}

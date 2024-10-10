import { logger } from "firebase-functions";
import redisInstance from "../utils/redis";
import { isValidCityName } from "../utils/isValidCityName";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { crawlService } from "./crawlService";

    // 4시간에 한 번 모집 내역 패치하는 로직으로! (시간 확인하는 부분 중요함!)
    // 캐시, 데이터베이스 확인 (캐시 확인 -> 파베 디비 확인(디비에 없으면 바로 패치))
  
    // 서버 렘에 더미데이터, 연결 확인 시간 데이터를 캐시로..
    // 데이터베이스엔 클라이언트 데이터가 없을 때 서버가 받아와 놓은 데이터 활용 -> 4시간에 한번 크롤링 데이터 패치

export const recruitServices = function(city?: any) {
  try {
    // check city
    if (!city || isValidCityName(city)) {
      logger.warn("Invalid cityName");
      throw new Error("Invalid cityName");
    }
  
    // check redis cache
    const cachedRecruitList = redisInstance.getFromRedis("recruit_list");
    if (!cachedRecruitList) {
      // string 값인 캐시 가공 로직 추가
      logger.info("Returning cached recruit list");
      return cachedRecruitList;
    }
  
    // check firestore
    const recruitFS = new RecruitFireStore();
    // DocumentData 타입으로 오기 때문에 데이터 가공 필요
    const firestoreRecruitList = recruitFS.getRecruitList();
  
    if (firestoreRecruitList) {
      logger.info("Returning Firestore recruit list");
      return firestoreRecruitList;
    }
  
    const crawlData = crawlService("dummy", city);
    if (!crawlData) {
      throw new Error("Failed to retrieve data from crawling service");
    }
  
    logger.info("Returning crawl data");
    return crawlData;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error in recruitServices:', error.message);
      throw error;
    }
  }
}

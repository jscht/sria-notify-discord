import { CRAWL_MODE } from "../constants/crawlMode";
import { requestDummyData, recruitScraper } from "../crawlers/sriagent";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { City } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import redisInstance from "../utils/redis";

export const crawlService = async function(mode: CRAWL_MODE, city?: City) {
  let result: ResponseRecruitData[] = [];

  try {
    if (mode === CRAWL_MODE.DUMMY) {
      result = await requestDummyData(city);
    } else if (mode === CRAWL_MODE.CRAWL) {
      const recruitData = await recruitScraper();
      result = city ? recruitData.filter((v) => v.title.includes(city)) : recruitData;
    }
  
    if (!result || !Array.isArray(result)) {
      throw new Error('Result is not an array.');
    }
  
    if (result.length === 0) {
      throw new Error('Result is empty.');
    }

    // redis, firestore 저장되는 방식, 형태 확인하기
    const firestore = new RecruitFireStore();
    
    Promise.all([
      firestore.saveRecruitList(result),
      (await redisInstance).setToRedis("recruit:list", result)
    ]);
  
    return result;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error('Error in crawlServices:', error);
    }
    throw error;
  }
};

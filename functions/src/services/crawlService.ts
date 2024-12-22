import { CRAWL_MODE } from "../constants/crawlMode";
import { requestDummyData, recruitScraper } from "../crawlers/sriagent";
import { CityKo } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import { cityNameConverter } from "../utils/cityNameConverter";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { getRedisInstance } from "../providers/redis";

export const crawlService = async function(mode: CRAWL_MODE, city?: CityKo) {
  const redisInstance = getRedisInstance();
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

    const recruitKey = redisInstance.getKeyManager().recruit.getKeys();
    const redisKey = city ? recruitKey.list(cityNameConverter.toEnglish(city)) : recruitKey.list();
    // 레디스 저장소에 데이터가 저장되지 않는 문제 발생, cli에서는 오히려 recruit:list 빼고 키가 등록되어 있음
    // 레디스 저장 확인 후 메모장 조회, 저장 방식 확인 후 수정

    Promise.all([
      firestore.saveRecruitList(result),
      redisInstance.setToRedis(redisKey, result)
    ]);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error('Error in crawlServices:', error);
    }
    throw error;
  }
};

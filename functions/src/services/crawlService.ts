import { CRAWL_MODE } from "../constants/crawlMode";
import { getCityFilteredList, recruitScraper } from "../crawlers/sriagent";
import { CityKo } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { getRedisInstance } from "../providers/redis";

export const crawlService = async function(mode: CRAWL_MODE, city?: CityKo) {
  const redisInstance = getRedisInstance();
  let result: ResponseRecruitData[] = [];

  try {
    if (mode === CRAWL_MODE.DUMMY) {
      result = await getCityFilteredList(mode, city);
    } else if (mode === CRAWL_MODE.CRAWL) {
      const recruitData = await recruitScraper();
      result = await getCityFilteredList(mode, city, recruitData);
    }

    if (!result || !Array.isArray(result)) {
      throw new Error('Result is not an array.');
    }

    if (result.length === 0) {
      throw new Error('Result is empty.');
    }

    const firestore = new RecruitFireStore();

    await Promise.all([
      firestore.saveRecruitList(result),
      redisInstance.setToRedis(result)
    ]);

    return result;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error('Error in crawlServices:', error);
    }
    return;
  }
};

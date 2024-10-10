import { logger } from "firebase-functions/v1";
import { requestCrawling, requestDummyData } from "../crawlers/sriagent";
import { City } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";

export const crawlService = async function(type: "dummy" | "crawl", city?: City) {
  let result: ResponseRecruitData[] | null = null;

  try {
    if (type === "dummy") {
      result = await requestDummyData(city);
    } else if (type === "crawl") {
      result = await requestCrawling(city);
    }
  
    if (!result || !Array.isArray(result)) {
      throw new Error('Result is not an array.');
    }
  
    if (result.length === 0) {
      throw new Error('Result is empty.');
    }
  
    return result;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error in crawlServices:', error.message);
      throw error;
    }
  }
};

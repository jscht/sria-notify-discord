import { requestDummyData } from "../crawlers/sriagent";
import { logger } from "firebase-functions";
import { City } from "../types/city";

export const crawlService = async function(city?: City) {
  try {
    // 캐시, 데이터베이스 확인

    // 크롤링 -> 더미데이터로 진행
    const crawlResult = await requestDummyData(city);
    if (crawlResult instanceof Error) {
      throw crawlResult;
    }

    // 디스코드 request

    return;
  } catch (error) {
    if (error instanceof Error) {
      logger.error("service failed:", error.message);
      return error;
    }
    logger.error("service failed", error);
    return new Error("service failed"); // 에러 객체 반환
  }
};

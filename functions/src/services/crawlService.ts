import { requestCrawling } from "../crawl";
import { logger } from "firebase-functions";
import { City } from "../types/city";

export const crawlService = async function(city?: City) {
  // 캐시, 데이터베이스 확인

  // 크롤링  
  await requestCrawling(city);

  // 디스코드 request

};

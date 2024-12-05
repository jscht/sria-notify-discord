// import { RedisClientType } from "redis";
import { recruitScraper } from "./recruitScraper";
import { requestDummyData } from "./requestDummyData";

// async function crawlingScheduler(redis: RedisClientType) {
//   try {
//     const data = function() { console.log("scheduler") };
//     if (!data || !Array.isArray(data) || data.length === 0) {
//       throw new Error('Crawled data is invalid or empty.');
//     }
//     redis.set("recruitList", JSON.stringify(data));
//     return data;
//   } catch (error) {
//     logger.error('Error during crawling:', error);
//   } finally {
//     // 4시간 주기
//     const coolTime = 10 * 1000; // 10초
//     setTimeout(crawlingScheduler, 4 * 60 * 60 * 1000);
//   }
// }

export { requestDummyData, recruitScraper };

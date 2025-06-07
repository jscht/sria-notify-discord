import { RecruitKeyManager } from "./recruitKeyManager";
import { CrawlKeyManager } from "./crawlKeyManager";

export const redisKeyManager = {
  recruit: new RecruitKeyManager(),
  crawl: new CrawlKeyManager(),
};
import { RedisClientType } from "redis";
import { CrawlKeyManager } from "../key/crawlKeyManager";

export class CrawlCacheStore {
  constructor(
    private readonly crawl_cache: RedisClientType,
    private readonly keyManager: CrawlKeyManager
  ) {}

  private getCrawlKeys() {
    return this.keyManager.getKeys();
  }

  async isRequestLimitSet() {
    const key = this.getCrawlKeys().request_allowed;
    const exists = await this.crawl_cache.exists(key);
    return Boolean(exists);
  }

  async setRequestLimit() {
    const key = this.getCrawlKeys().request_allowed;
    // 요청 가능 시 키 생성 및 10분 TTL 설정
    await this.crawl_cache.setEx(key, 600, "limit");
  }
};
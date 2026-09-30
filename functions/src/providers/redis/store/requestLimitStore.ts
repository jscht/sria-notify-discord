import { RedisClientType } from "redis";
import { RequestLimitKeyManager } from "../key/requestLimitKeyManager";

/**
 * 공고 요청 제한(10분 쿨다운) 스토어. (Phase 1.10 — 구 CrawlCacheStore)
 *
 * 크롤 제거 후에도 사용자 공고 요청 폭주를 막는 쿨다운 키만 승계한다.
 */
export class RequestLimitStore {
  constructor(
    private readonly cache: RedisClientType,
    private readonly keyManager: RequestLimitKeyManager
  ) {}

  private getKeys() {
    return this.keyManager.getKeys();
  }

  async isRequestLimitSet() {
    const key = this.getKeys().request_allowed;
    const exists = await this.cache.exists(key);
    return Boolean(exists);
  }

  async setRequestLimit() {
    const key = this.getKeys().request_allowed;
    // 요청 가능 시 키 생성 및 10분 TTL 설정
    await this.cache.setEx(key, 600, "limit");
  }
}

import "@/common/utils/systemLogger";
import { RedisClientType } from "redis";
import { RecruitCacheStore, RecruitHashStore, CrawlCacheStore } from "../store";
import { redisKeyManager } from "../key";
import { redisConnection } from "../client/connection";

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  
  public readonly store: {
    recruit: RecruitCacheStore;
    recruit_hash: RecruitHashStore;
    crawl: CrawlCacheStore;
  };

  private constructor(client: RedisClientType) {
    this.client = client;
    this.store = {
      recruit: new RecruitCacheStore(client, redisKeyManager.recruit),
      recruit_hash: new RecruitHashStore(client, redisKeyManager.recruit),
      crawl: new CrawlCacheStore(client, redisKeyManager.crawl),
    };
  }

  static async initialize() {
    if (RedisManager.instance) {
      globalLogger.info("Redis instance already initialized.");
      return;
    }

    const client = await redisConnection();

    if (!client) {
      throw new Error("Failed to create Redis client");
    }

    RedisManager.instance = new RedisManager(client);
    globalLogger.info("Redis initialized successfully.");
  }

  static getInstance() {
    if (!RedisManager.instance) {
      throw new Error("RedisManager not initialized. Call initialize() first.");
    }
    return RedisManager.instance;
  }

  async scanToPattern(cursorCount: number, pattern: string) {
    try {
      const { cursor, keys } = await this.client.scan(cursorCount, { MATCH: pattern });
      return { newCursor: cursor, foundKeys: keys };
    } catch (error) {
      if (error instanceof Error) {
        globalLogger.error(
          `During SCAN with cursor "${cursorCount}" and pattern "${pattern}"\nmessage: `, error
        );
      }
      return { newCursor: 0, foundKeys: [] };
    }
  }
};
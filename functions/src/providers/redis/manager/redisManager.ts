import { RedisClientType } from "redis";
import { RecruitCacheStore, CrawlCacheStore } from "../store";
import { redisKeyManager } from "../key";
import { redisConnection } from "../client/connection";

export class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType;
  
  public readonly store: {
    recruit: RecruitCacheStore;
    crawl: CrawlCacheStore;
  };

  private constructor(client: RedisClientType) {
    this.client = client;
    this.store = {
      recruit: new RecruitCacheStore(client, redisKeyManager.recruit),
      crawl: new CrawlCacheStore(client, redisKeyManager.crawl),
    };
  }

  static async initialize() {
    if (RedisManager.instance) {
      DebugLogger.server("Redis instance already initialized.");
      return;
    }

    const client = await redisConnection();
    if (!client) {
      throw new Error("Failed to create Redis client");
    }

    RedisManager.instance = new RedisManager(client);
    DebugLogger.request("Redis initialized successfully.");
  }

  static getInstance() {
    if (!RedisManager.instance) {
      throw new Error("RedisManager not initialized. Call initialize() first.");
    }
    DebugLogger.request("Successfully got Redis instance.");
    return RedisManager.instance;
  }

  async scanToPattern(cursorCount: number, pattern: string) {
    try {
      const { cursor, keys } = await this.client.scan(cursorCount, { MATCH: pattern });
      return { newCursor: cursor, foundKeys: keys };
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(
          `During SCAN with cursor "${cursorCount}" and pattern "${pattern}"\nmessage: `, error
        );
      }
      return { newCursor: 0, foundKeys: [] };
    }
  }
};
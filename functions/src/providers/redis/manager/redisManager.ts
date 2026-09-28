import "@/common/utils/systemLogger";
import crypto from "node:crypto";
import { RedisClientType } from "redis";
import { RecruitCacheStore, RecruitHashStore, CrawlCacheStore } from "../store";
import { redisKeyManager } from "../key";
import { redisConnection } from "../client/connection";

export class RedisManager {
  private static instance: RedisManager;
  private static initPromise: Promise<void> | null = null;
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

    // 동시 호출 시 진행 중인 초기화를 공유 — 연결 중복 생성 방지
    if (!RedisManager.initPromise) {
      RedisManager.initPromise = RedisManager.connect().catch((error) => {
        RedisManager.initPromise = null; // 실패 시 재시도 허용
        throw error;
      });
    }
    return RedisManager.initPromise;
  }

  private static async connect() {
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

  /**
   * 분산 락 획득 (SET key token NX PX). 획득 성공 시 해제용 토큰 반환, 실패(이미 잠김) 시 null.
   * @param key 락 키 (예: "lock:recruit:crawlAndDiff")
   * @param ttlMs 락 자동 만료(ms) — 홀더 크래시 시 교착 방지
   */
  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = crypto.randomUUID();
    const res = await this.client.set(key, token, { NX: true, PX: ttlMs });
    return res === "OK" ? token : null;
  }

  /**
   * 분산 락 해제 — 토큰이 일치할 때만 삭제(다른 홀더 락 오삭제 방지). CAS는 Lua로 원자 처리.
   */
  async releaseLock(key: string, token: string): Promise<void> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await this.client.eval(lua, { keys: [key], arguments: [token] });
  }

  /**
   * 값이 없을 때만 세팅한다 (SET key value NX [PX]). 새로 세팅되면 true. (Phase 1.10 incident용)
   */
  async setIfAbsent(key: string, value: string, ttlMs?: number): Promise<boolean> {
    const options = ttlMs ? { NX: true as const, PX: ttlMs } : { NX: true as const };
    const res = await this.client.set(key, value, options);
    return res === "OK";
  }

  /** 문자열 값 조회. */
  async getValue(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** 키 삭제. */
  async deleteKey(key: string): Promise<void> {
    await this.client.del(key);
  }
};
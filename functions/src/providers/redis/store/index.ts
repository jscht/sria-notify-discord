import { RedisClientType } from "redis";
import crypto from "crypto";
import { redisKeyManager } from "../key";
import { redisConnection } from "../client/connection";
import { ResponseRecruitData } from "../../../types/responseRecruitData";

interface Job {
  id: string;
  value: ResponseRecruitData;
};

type HashedString = string;

type JobHashes = Record<string, HashedString>;

export class RedisStore {
  private static getClient: () => RedisClientType;
  private static instance: RedisStore | null = null;
  private readonly redisKeyManager;
  private readonly DataChangeStatus = {
    NO_DATA: "NO_DATA", 
    NO_CHANGES: "NO_CHANGES", 
    DATA_CHANGED: "DATA_CHANGED" 
  }

  constructor(client: RedisClientType) {
    RedisStore.getClient = () => client;
    this.redisKeyManager = redisKeyManager;
  }

  static async initialize() {
    if (RedisStore.instance) {
      DebugLogger.server("Redis instance already initialized.");
      return Promise.resolve();
    }
    const client = await redisConnection();
    if (!client) {
      throw new Error("Redis client could not be created.");
    }
    DebugLogger.request("Redis initialized successfully.");
    RedisStore.instance = new RedisStore(client);
  }

  static getInstance() {
    if (!RedisStore.instance) {
      throw new Error("Failed to get Redis instance.");
    }
    DebugLogger.request("Successfully got Redis instance.");
    return RedisStore.instance!;
  }

  getKeyManager() {
    return redisKeyManager;
  }

  // city에 해당하는 id set 반환
  // #indexCityKey(city: string): string {
  //   return `${redisKeyManager.recruit.getServiceName()}:${encodeURIComponent(city)}`;
  // }

  #hashObject(recruitObject: any) {
    const jsonString = JSON.stringify(recruitObject);
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }

  #extractId(href: string) {
    return href.replace("/jobs/", "");
  }

  async scanToPattern(cursorCount: number, pattern: string) {
    const client = RedisStore.getClient();

    try {
      const { cursor, keys } = await client.scan(cursorCount, { MATCH: pattern });
      return { newCursor: cursor, foundKeys: keys };
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error during SCAN with cursor "${cursorCount}" and pattern "${pattern}"\nmessage: `, error);
      }
      return { newCursor: 0, foundKeys: [] };
    }
  }

  async getDataByKeyFromRedis(key: string) {
    try {
      const client = RedisStore.getClient();
      const result = await client.hGetAll(key);

      if (result && Object.keys(result).length > 0) {
        DebugLogger.server(`Retrieved data for key: ${key}`);
        return result;
      } else {
        DebugLogger.server(`No data found for key: ${key}`);
        return null;
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error retrieving data for key: ${key}`, error);
      }
      throw error;
    }
  }

  async getHashDataFromRedis() {
    const key = this.redisKeyManager.recruit.getKeys().list();

    try {
      const client = RedisStore.getClient();
      const result = await client.hGetAll(key);

      if (result && Object.keys(result).length > 0) {
        DebugLogger.server(`Retrieved data for key: ${key}`);
        return result;
      } else {
        DebugLogger.server(`No data found for key: ${key}`);
        return null;
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error retrieving data for key: ${key}`, error);
      }
      throw error;
    }
  }

  private async saveToRedis(client: RedisClientType, id: string, newData: Record<string, any>, expirationTimeInSeconds: number) {
    const key = this.redisKeyManager.recruit.getKeys().list();

    try {
      await client.hSet(key, id, JSON.stringify(newData));
      await client.expire(key, expirationTimeInSeconds);
      DebugLogger.request(`Saved data for ID: ${id}`);
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error saving data for ID: ${id}`, error);
      }
      throw error;
    }
  }

  private async saveHashToRedis(client: RedisClientType, id: string, newData: string, expirationTimeInSeconds: number) {
    const key = this.redisKeyManager.recruit.getKeys().list_hash();

    try {
      await client.hSet(key, id, newData);
      await client.expire(key, expirationTimeInSeconds);
      DebugLogger.request(`Saved hash for ID: ${id}`);
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error saving hash for ID: ${id}`, error);
      }
      throw error;
    }
  }

  private async deleteFromRedis(client: RedisClientType, id: string) {
    const key = this.redisKeyManager.recruit.getKeys().list();

    try {
      await client.hDel(key, id);
      DebugLogger.request(`Deleted data for ID: ${id}`);
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error deleting data for ID: ${id}`, error);
      }
      throw error;
    }
  }

  private async deleteHashFromRedis(client: RedisClientType, id: string) {
    const key = this.redisKeyManager.recruit.getKeys().list_hash();

    try {
      await client.hDel(key, id);
      DebugLogger.request(`Deleted hash for ID: ${id}`);
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error deleting hash for ID: ${id}`, error);
      }
      throw error;
    }
  }

  private async addJobsToRedis(client: RedisClientType, newData: Job[], newHashes: JobHashes, expirationTimeInSeconds: number) {
    try {
      for (let job of newData) {
        const { id, value: recruitData } = job;
        await this.saveToRedis(client, id, recruitData, expirationTimeInSeconds);
        await this.saveHashToRedis(client, id, newHashes[id], expirationTimeInSeconds);
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error adding jobs to Redis", error);
      }
      throw error;
    }
  }

  private async deleteJobsFromRedis(client: RedisClientType, deletedIds: string[]) {
    try {
      for (const id of deletedIds) {
        await this.deleteFromRedis(client, id);
        await this.deleteHashFromRedis(client, id);
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error deleting jobs from Redis", error);
      }
      throw error;
    }
  }

  private async updateJobsInRedis(client: RedisClientType, updatedJobs: Job[], newHashes: JobHashes, expirationTimeInSeconds: number) {
    try {
      for (const job of updatedJobs) {
        const { id, value: recruitData } = job;
        await this.saveToRedis(client, id, recruitData, expirationTimeInSeconds);
        await this.saveHashToRedis(client, id, newHashes[id], expirationTimeInSeconds);
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error updating jobs in Redis", error);
      }
      throw error;
    }
  }

  private mapToJob(responseData: ResponseRecruitData[]): Job[] {
    return responseData.map((recruitData) => ({
      id: this.#extractId(recruitData.href),
      value: recruitData
    }));
  }

  async setToRedis(responseData: ResponseRecruitData[]) {
    const { NO_DATA, NO_CHANGES, DATA_CHANGED } = this.DataChangeStatus;
    let changeStatus = NO_CHANGES;

    try {
      const client = RedisStore.getClient();
      const expirationTimeInSeconds = 6 * 60 * 60; // 6시간

      const newData = this.mapToJob(responseData);

      // 새 데이터의 해시 계산
      const newHashes = newData.reduce<JobHashes>((acc, job) => {
        acc[job.id] = this.#hashObject(JSON.stringify(job.value));
        return acc;
      }, {});

      // Redis에서 현재 저장된 해시 값 가져오기
      const currentHashes = await this.getHashDataFromRedis();

      if (!currentHashes) {
        // 레디스에 저장된 데이터가 없음 -> 수정 여부 확인 건너뛰고 저장 필요
        changeStatus = NO_DATA;

        await this.addJobsToRedis(client, newData, newHashes, expirationTimeInSeconds);
        DebugLogger.server(`No data found. Data cached successfully and expiry of 6 hours.`);
        return;
      }

      // 새 데이터의 ID와 기존 데이터의 ID 비교
      const currentIdSet = new Set(Object.keys(currentHashes!));
      const newIdSet = new Set(Object.keys(newHashes));

      // 추가, 삭제 데이터
      const addedJobs = newData.filter((job) => !currentIdSet.has(this.#extractId(job.id)));
      const deletedIds = Array.from(currentIdSet).filter((id) => !newIdSet.has(id));

      // 수정된 데이터 (해시 비교)
      const updatedJobs = newData.filter((job) => {
        const currentHash = currentHashes![job.id];
        const newHash = newHashes[job.id];
        return !currentHash || this.#hashObject(currentHash) !== newHash;
      });

      if (addedJobs.length > 0 || deletedIds.length > 0 || updatedJobs.length > 0) {
        // 기존 캐시와의 변경점이 있음 -> 캐시 수정 필요
        changeStatus = DATA_CHANGED;

        DebugLogger.server(`addedJobs: ${addedJobs.length}`)
        DebugLogger.server(`deletedIds: ${deletedIds.length}`)
        DebugLogger.server(`updatedJobs: ${updatedJobs.length}`)
      }

      if (changeStatus === DATA_CHANGED) {
        await this.addJobsToRedis(client, addedJobs, newHashes, expirationTimeInSeconds);
        await this.deleteJobsFromRedis(client, deletedIds);
        await this.updateJobsInRedis(client, updatedJobs, newHashes, expirationTimeInSeconds);

        DebugLogger.server("Data in Redis has been updated.");
      } else {
        const listKey = this.redisKeyManager.recruit.getKeys().list();
        const listHashKey = this.redisKeyManager.recruit.getKeys().list_hash();

        await client.expire(listKey, expirationTimeInSeconds);
        await client.expire(listHashKey, expirationTimeInSeconds);

        DebugLogger.server("No changes detected in data. Cache expiration time has been reapplied.");
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error setting cache to Redis:", error);
      }
      throw error;
    }
  }
}

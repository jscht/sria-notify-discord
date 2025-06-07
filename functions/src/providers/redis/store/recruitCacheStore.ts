import { RedisClientType } from "redis";
import crypto from "crypto";
import { RecruitKeyManager } from "../key/recruitKeyManager";
import { ResponseRecruitData } from "../../../types/responseRecruitData";

interface Job {
  id: string;
  value: ResponseRecruitData;
}

type HashedString = string;

type JobHashes = Record<string, HashedString>;


export class RecruitCacheStore {
  private readonly DataChangeStatus = {
    NO_DATA: "NO_DATA",
    NO_CHANGES: "NO_CHANGES",
    DATA_CHANGED: "DATA_CHANGED",
  };

  constructor(
    private readonly recruit_cache: RedisClientType,
    private readonly keyManager: RecruitKeyManager
  ) {}

  #hashObject(obj: any) {
    return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
  }

  #extractId(href: string) {
    return href.replace("/jobs/", "");
  }

  private getRecruitKeys() {
    return this.keyManager.getKeys();
  }

  // 테스트용 함수가 될 것 같음.
  async getDataByKeyFromCache(key: string) {
    const result = await this.recruit_cache.hGetAll(key);

    if (result && Object.keys(result).length > 0) {
      DebugLogger.server(`Retrieved data for key: ${key}`);
      return Object.values(result).map((json) => JSON.parse(json));
    } else {
      DebugLogger.server(`No data found for key: ${key}`);
      return null;
    }
  }

  async getRecruitListFromCache(city?: string) {
    const key = this.getRecruitKeys().list();  // city
    const result = await this.recruit_cache.hGetAll(key);

    if (result && Object.keys(result).length > 0) {
      DebugLogger.server(`Retrieved data for key: ${key}`);
      return Object.values(result).map((json) => JSON.parse(json));
    } else {
      DebugLogger.server(`No data found for key: ${key}`);
      return null;
    }
  }

  private async getHashData() {
    const key = this.getRecruitKeys().list();
    const result = await this.recruit_cache.hGetAll(key);

    if (result && Object.keys(result).length > 0) {
      DebugLogger.server(`Retrieved data for key: ${key}`);
      return result;
    } else {
      DebugLogger.server(`No data found for key: ${key}`);
      return null;
    }
  }

  private async saveToCache(
    id: string,
    newData: Record<string, any>,
    expirationTimeInSeconds: number
  ) {
    const key = this.getRecruitKeys().list();

    await this.recruit_cache.hSet(key, id, JSON.stringify(newData));
    await this.recruit_cache.expire(key, expirationTimeInSeconds);
    DebugLogger.request(`Saved data for ID: ${id}`);
  }

  private async saveHashToCache(
    id: string,
    newData: string,
    expirationTimeInSeconds: number
  ) {
    const key = this.getRecruitKeys().list_hash();

    await this.recruit_cache.hSet(key, id, newData);
    await this.recruit_cache.expire(key, expirationTimeInSeconds);
    DebugLogger.request(`Saved hash for ID: ${id}`);
  }

  private async deleteFromCache(id: string) {
    const key = this.getRecruitKeys().list();

    await this.recruit_cache.hDel(key, id);
    DebugLogger.request(`Deleted data for ID: ${id}`);
  }

  private async deleteHash(id: string) {
    const key = this.getRecruitKeys().list_hash();

    await this.recruit_cache.hDel(key, id);
    DebugLogger.request(`Deleted hash for ID: ${id}`);
  }

  private async addJobs(
      newData: Job[],
      newHashes: JobHashes,
      expirationTimeInSeconds: number
    ) {
      for (const job of newData) {
        const { id, value: recruitData } = job;
        await this.saveToCache(id, recruitData, expirationTimeInSeconds);
        await this.saveHashToCache(id, newHashes[id], expirationTimeInSeconds);
      }
    }

  private async deleteJobs(deletedIds: string[]) {
    for (const id of deletedIds) {
      await this.deleteFromCache(id);
      await this.deleteHash(id);
    }
  }

  private async updateJobs(
      updatedJobs: Job[],
      newHashes: JobHashes,
      expirationTimeInSeconds: number
    ) {
      for (const job of updatedJobs) {
        const { id, value: recruitData } = job;
        await this.saveToCache(id, recruitData, expirationTimeInSeconds);
        await this.saveHashToCache(id, newHashes[id], expirationTimeInSeconds);
      }
    }

  private mapToJob(list: ResponseRecruitData[]): Job[] {
    return list.map((job) => ({
      id: this.#extractId(job.href),
      value: job,
    }));
  }

  async setRecruitListToCache(list: ResponseRecruitData[]) {
    const { NO_DATA, NO_CHANGES, DATA_CHANGED } = this.DataChangeStatus;
    let changeStatus = NO_CHANGES;

    const expirationTimeInSeconds = 6 * 60 * 60; // 6시간

    const newData = this.mapToJob(list);

    // 새 데이터의 해시 계산
    const newHashes = newData.reduce<JobHashes>((acc, job) => {
      acc[job.id] = this.#hashObject(JSON.stringify(job.value));
      return acc;
    }, {});

    // Redis에서 현재 저장된 해시 값 가져오기
    const currentHashes = await this.getHashData();

    if (!currentHashes) {
      // 레디스에 저장된 데이터가 없음 -> 수정 여부 확인 건너뛰고 저장 필요
      changeStatus = NO_DATA;

      await this.addJobs(newData, newHashes, expirationTimeInSeconds);
      DebugLogger.server("No data found. Data cached successfully and expiry of 6 hours.");
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

      DebugLogger.server(`
        addedJobs: ${addedJobs.length}\n
        deletedIds: ${deletedIds.length}\n
        updatedJobs: ${updatedJobs.length}
      `);
    }

    if (changeStatus === DATA_CHANGED) {
      await this.addJobs(addedJobs, newHashes, expirationTimeInSeconds);
      await this.deleteJobs(deletedIds);
      await this.updateJobs(updatedJobs, newHashes, expirationTimeInSeconds);

      DebugLogger.server("Data in Redis has been updated.");
    } else {
      const listKey = this.keyManager.getKeys().list();
      const listHashKey = this.keyManager.getKeys().list_hash();

      await this.recruit_cache.expire(listKey, expirationTimeInSeconds);
      await this.recruit_cache.expire(listHashKey, expirationTimeInSeconds);

      DebugLogger.server("No changes detected in data. Cache expiration time has been reapplied.");
    }
  }
};
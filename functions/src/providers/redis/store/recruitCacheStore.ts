import { RedisClientType } from "redis";
import { RecruitKeyManager } from "../key/recruitKeyManager";
import type { Recruit } from "@/common/types";

// #region Redis Functions...
// #endregion

export class RecruitCacheStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyManager: RecruitKeyManager
  ) {}

  private getRecruitCacheKey() {
    return this.keyManager.getKeys().list;
  }

  async save(id: string, data: Recruit, expiration: number): Promise<void> {
    const key = this.getRecruitCacheKey();
    await this.client.hSet(key, id, JSON.stringify(data));
    await this.expire(expiration, key);
    globalLogger.info(`Saved data for ID: ${id}`);
  }

  async getAll(): Promise<Recruit[] | null> {
    const key = this.getRecruitCacheKey();
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0 ?
      Object.values(result).map((json) => JSON.parse(json)) :
      null;
  }

  // 테스트용 될 듯?
  async getDataByKeyFromCache(key: string): Promise<Recruit[] | null> {
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0 ?
      Object.values(result).map((json) => JSON.parse(json)) :
      null;
  }

  async delete(id: string): Promise<void> {
    const key = this.getRecruitCacheKey();
    await this.client.hDel(key, id);
    globalLogger.info(`Deleted data for ID: ${id}`);
  }

  async expire(expiration: number, key?: string): Promise<void> {
    await this.client.expire(!key ? this.getRecruitCacheKey() : key, expiration);
  }
}

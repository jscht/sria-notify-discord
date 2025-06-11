import { RedisClientType } from "redis";
import { RecruitKeyManager } from "../key/recruitKeyManager";
import { ResponseRecruitData } from "../../../types/responseRecruitData";
import { CityEn } from "../../../types/city";

// #region Redis Functions...
// #endregion

export class RecruitCacheStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyManager: RecruitKeyManager
  ) {}

  private getRecruitCacheKey(city?: CityEn) {
    return this.keyManager.getKeys().list(city);
  }

  async save(id: string, data: ResponseRecruitData, expiration: number) {
    const key = this.getRecruitCacheKey();
    await this.client.hSet(key, id, JSON.stringify(data));
    await this.expire(expiration, key);
    DebugLogger.request(`Saved data for ID: ${id}`);
  }

  async getAll() {
    const key = this.getRecruitCacheKey();
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0
      ? Object.values(result).map((json) => JSON.parse(json))
      : null;
  }

  async getByCity(city: string) {
    const key = this.getRecruitCacheKey(city as CityEn);
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0
      ? Object.values(result).map((json) => JSON.parse(json))
      : null;
  }

  // 테스트용 될 듯?
  async getDataByKeyFromCache(key: string) {
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0
      ? Object.values(result).map((json) => JSON.parse(json))
      : null;
  }

  async delete(id: string) {
    const key = this.getRecruitCacheKey();
    await this.client.hDel(key, id);
    DebugLogger.request(`Deleted data for ID: ${id}`);
  }

  async expire(expiration: number, key?: string) {
    await this.client.expire(!key ? this.getRecruitCacheKey() : key, expiration);
  }
}
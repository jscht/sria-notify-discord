import { RedisClientType } from "redis";
import { RecruitKeyManager } from "../key/recruitKeyManager";
import type { CityEn } from "@/common/types";

export class RecruitHashStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyManager: RecruitKeyManager
  ) {}

  private getRecruitHashKey(city?: CityEn) {
    return this.keyManager.getKeys().list_hash(city);
  }

  async save(id: string, hash: string, expiration: number) {
    const key = this.getRecruitHashKey();
    await this.client.hSet(key, id, hash);
    await this.expire(expiration, key);
    globalLogger.info(`Saved hash for ID: ${id}`);
  }

  async getAll(): Promise<Record<string, string> | null> {
    const key = this.getRecruitHashKey();
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0 ? result : null;
  }

  async getByCity(city: string) {
    const key = this.getRecruitHashKey(city as CityEn);
    const result = await this.client.hGetAll(key);
    return Object.keys(result).length > 0 ? result : null;
  }

  async delete(id: string) {
    const key = this.getRecruitHashKey();
    await this.client.hDel(key, id);
    globalLogger.info(`Deleted hash for ID: ${id}`);
  }

  async expire(expiration: number, key?: string) {
    await this.client.expire(!key ? this.getRecruitHashKey() : key, expiration);
  }
}
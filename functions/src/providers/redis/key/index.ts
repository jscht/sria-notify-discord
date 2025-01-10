import { KeyManager } from './../../../types/redisKeyManager.d';
import { RecruitKeyManager } from "./keyManager";

const redisKeys = {
  recruit: RecruitKeyManager,
};

export type RedisKeyManager = KeyManager<typeof redisKeys>;

export const redisKeyManager: RedisKeyManager = {
  recruit: new RecruitKeyManager,
};

import { RedisManager } from "./manager/redisManager";

export const initRedis = async () => await RedisManager.initialize();
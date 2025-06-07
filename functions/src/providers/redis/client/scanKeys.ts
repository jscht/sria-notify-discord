import { RedisManager } from "../manager/redisManager";

export async function scanKeys(pattern: string) {
  const redisInstance = RedisManager.getInstance();

  let cursor = 0;
  const keys: string[] = [];

  do {
    const { newCursor, foundKeys } = await redisInstance.scanToPattern(cursor, pattern);

    keys.push(...foundKeys);
    cursor = newCursor;
  } while (cursor !== 0);

  return keys;
}
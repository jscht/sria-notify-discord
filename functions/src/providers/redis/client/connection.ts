import { createClient, RedisClientType } from "redis";

export async function redisConnection() {
  try {
    // 서버 배포 후 redis 배포에 대해서도 찾아야 함
    const redis: RedisClientType = createClient({
      socket: {
        host: "127.0.0.1",
        port: 6379
      }
    });

    redis.on("ready", () => {
      DebugLogger.server("redis connected.");
    });

    await redis.connect();

    return redis;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("redis connection error.", error);
    }
    throw error;
  }
}

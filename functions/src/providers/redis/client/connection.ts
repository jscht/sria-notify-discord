import { createClient, RedisClientType } from "redis";

export async function redisConnection() {
  try {
    // 서버 배포 후 redis 배포에 대해서도 찾아야 함
    const client: RedisClientType = createClient({
      socket: {
        host: "127.0.0.1",
        port: 6379
      },
    });

    client.on("ready", () => {
      DebugLogger.server("redis connected.");
    });

    await client.connect();

    return client;
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Redis connection failed:", error);
    }
    return null;
  }
};
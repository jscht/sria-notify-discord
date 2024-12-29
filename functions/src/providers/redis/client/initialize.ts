import { RedisStore } from "../store";

export async function initRedis() {
  try {
    await RedisStore.initialize();
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Redis initialization failed:", error);
    }
    throw error;
  }
}

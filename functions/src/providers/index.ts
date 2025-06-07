import { initDiscordBot } from "./discord";
import { initFirebaseApp } from "./firebase";
import { initRedis } from "./redis";

// 서버 종료 시 외부 서비스 연결 해제 설정 필요

export async function initializeProviders() {
  try {
    await Promise.all([
      initFirebaseApp(),
      initRedis(),
      initDiscordBot(),
    ]);
    DebugLogger.server("All providers initialized successfully.");
  } catch (error) {
    throw error;
  }
}
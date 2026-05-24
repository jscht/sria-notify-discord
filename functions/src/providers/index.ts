import { initDiscordBot } from "./discord";
import { initFirebaseApp } from "./firebase";
import { initRedis } from "./redis";

// 서버 종료 시 외부 서비스 연결 해제 설정 필요

let initPromise: Promise<void> | null = null;

export function initializeProviders(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await Promise.all([
      initFirebaseApp(),
      initRedis(),
      initDiscordBot(),
    ]);
    globalLogger.info("All providers initialized successfully.");
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}
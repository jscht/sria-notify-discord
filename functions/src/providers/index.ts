import "@/common/utils/systemLogger";
import { initDiscordBot, initDiscordRest } from "./discord";
import { initFirebaseApp } from "./firebase";
import { initRedis } from "./redis";

// 서버 종료 시 외부 서비스 연결 해제 설정 필요

let gatewayInitPromise: Promise<void> | null = null;
let functionInitPromise: Promise<void> | null = null;

/**
 * Gateway 프로세스: Firebase+Redis+Discord gateway(WS+login+ready 빗장).
 * 인터랙션(슬래시 커맨드·버튼 등) 수신용. 메모이즈된다.
 */
export function initGatewayProviders(): Promise<void> {
  if (gatewayInitPromise) return gatewayInitPromise;

  gatewayInitPromise = (async () => {
    await Promise.all([
      initFirebaseApp(),
      initRedis(),
      initDiscordBot(),
    ]);
    globalLogger.info("All providers initialized successfully.");
  })().catch((error) => {
    gatewayInitPromise = null;
    throw error;
  });

  return gatewayInitPromise;
}

/**
 * 함수 프로세스: Firebase+Redis+Discord REST(login/ready 없음).
 * onSchedule 크롤·알림용. 메모이즈된다.
 */
export function initFunctionProviders(): Promise<void> {
  if (functionInitPromise) return functionInitPromise;

  functionInitPromise = (async () => {
    await Promise.all([
      initFirebaseApp(),
      initRedis(),
    ]);
    initDiscordRest(); // REST 토큰 주입(동기) — gateway WS/login 없음
    globalLogger.info("Function providers initialized (REST only).");
  })().catch((error) => {
    functionInitPromise = null;
    throw error;
  });

  return functionInitPromise;
}

/**
 * 하위 호환 별칭 — 기존 import처(app/index.ts) 보호.
 * gateway 번들과 동일하다.
 */
export const initializeProviders = initGatewayProviders;

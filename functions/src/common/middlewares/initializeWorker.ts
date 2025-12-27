/**
 * Initialize Worker Middleware
 * 애플리케이션 초기화 및 스케줄러 시작
 */

import { initializeSchedulers, setupGracefulShutdown } from "@/crawlers";
import type { Request, Response, NextFunction } from "express";
import { CRAWL_MODE } from "../constants";

let isInitialized = false;

/**
 * 애플리케이션 초기화 미들웨어
 * 한 번만 실행되며 Provider 초기화 및 스케줄러를 시작합니다.
 */
export default async function initializeWorker(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (isInitialized) {
    return next();
  }

  try {
    // 동적 import로 순환 참조 방지
    const { initializeProviders } = await import("@/providers");

    // Provider 초기화 (Firebase, Redis, Discord)
    await initializeProviders();

    // 스케줄러 초기화
    const manager = initializeSchedulers({
      recruitInterval: 4 * 60 * 60 * 1000, // 4시간
      recruitMode: CRAWL_MODE.DUMMY,
    });

    // Graceful shutdown 설정
    setupGracefulShutdown(manager);

    isInitialized = true;
    DebugLogger.server("✅ Initialization completed successfully.");

    next();
  } catch (error) {
    next(error);
  }
}

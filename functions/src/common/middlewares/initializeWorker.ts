/**
 * Initialize Worker Middleware
 * 애플리케이션 초기화 및 크롤링 작업 시작
 */

import type { Request, Response, NextFunction } from "express";

let isInitialized = false;

/**
 * 애플리케이션 초기화 미들웨어
 * 한 번만 실행되며 Provider 초기화 및 크롤링 작업을 시작합니다.
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
    // const { crawler, scheduler } = await import("@/crawlers");

    await initializeProviders(); // Provider 초기화

    // TODO: 실제 크롤링 작업 활성화
    // await crawler.proxy();
    // await Promise.all([
    //   crawler.sriagent(),
    //   scheduler.sriagent(),  // 4시간에 한 번 모집 내역 패치
    // ])

    isInitialized = true;
    DebugLogger.server("Initialization completed successfully.");

    next();
  } catch (error) {
    next(error);
  }
}

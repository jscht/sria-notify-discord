import { Request, Response, NextFunction } from "express";
import { initializeProviders } from "../providers";
import { crawler, scheduler } from "../crawlers";

let isInitialized = false;

export default async function initializeWorker(req: Request, res: Response, next: NextFunction) {
  if (isInitialized) {
    return next();
  }

  try {
    await initializeProviders();  // provider initialize
    // await crawler.proxy();
    // await Promise.all([
    //   crawler.sriagent(),
    //   scheduler.sriagent(),  // 4시간에 한 번 모집 내역 패치 (테스트 동안 2분 간격)
    // ])
    isInitialized = true;
    DebugLogger.server("Initialization and scraping completed successfully.");

    next();
  } catch (error) {
    next(error);
  }
}
import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/httpError";
import { initializeProviders } from "../providers";
import { runScraper } from "../crawlers/sriagent";

let isInitialized = false;

export default async function initializeWorker(req: Request, res: Response, next: NextFunction) {
  if (isInitialized) {
    return next();
  }

  try {
    await initializeProviders();  // provider 초기 설정
    await runScraper();  // 4시간에 한 번 모집 내역 패치 (테스트 동안 2분 간격)
    isInitialized = true;
    DebugLogger.server("Initialization and scraping completed successfully.");

    next();
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error during initialization or scraping:", error);
      next(HttpError.ServiceUnavailable("Initialization failed. Please try again later."));
    } else {
      next(error);
    }
  }
}
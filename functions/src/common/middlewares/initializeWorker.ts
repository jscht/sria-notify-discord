import "@/common/utils/systemLogger";
/**
 * Initialize Worker Middleware
 * Provider init이 완료될 때까지 요청을 보류하는 게이트.
 * 실제 init은 모듈 로드 시점에 app/index.ts에서 시작되며,
 * initializeProviders()는 메모이즈되어 있어 여기서 await만 한다.
 */

import { initializeProviders } from "@/providers";
import type { Request, Response, NextFunction } from "express";

// 스케줄러는 별도 의사결정 영역으로 분리됨 (현재 비활성화).
// 활성화 시 app/index.ts의 eager init과 동일한 위치에서 시작할 것.
// import { initializeSchedulers, setupGracefulShutdown } from "@/crawlers";
// import { CRAWL_MODE } from "../constants";

export default async function initializeWorker(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await initializeProviders();
    next();
  } catch (error) {
    next(error);
  }
}

import "@/common/utils/systemLogger";
/**
 * Initialize Worker Middleware
 * Provider init이 완료될 때까지 요청을 보류하는 게이트.
 * 실제 init은 모듈 로드 시점에 app/index.ts에서 시작되며,
 * initializeProviders()는 메모이즈되어 있어 여기서 await만 한다.
 */

import { initializeProviders } from "@/providers";
import type { Request, Response, NextFunction } from "express";

// 스케줄러 init은 app/index.ts의 eager 블록(provider init 완료 후)에서 시작한다 (Phase 1.9 확정).
// 이 미들웨어는 provider init 게이트만 담당한다.

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

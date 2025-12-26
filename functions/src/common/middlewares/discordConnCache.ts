/**
 * Discord Connection Cache Middleware
 * 10분 간격 Discord 연결 확인
 */

import type { Request, Response, NextFunction } from "express";

let discordLastCheckTime: number | null = null;

/**
 * Discord 연결 상태를 캐시하는 미들웨어
 * 10분마다 연결을 확인합니다.
 */
export async function discordConnCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // TODO: Discord 연결 확인 로직 구현
  next();
}

import "@/common/utils/logger";
/**
 * Firebase Connection Cache Middleware
 * 10분 간격 Firebase 연결 확인
 */

import type { Request, Response, NextFunction } from "express";

let fbLastCheckTime: number | null = null;

/**
 * Firebase 연결 상태를 캐시하는 미들웨어
 * 10분마다 연결을 확인합니다.
 */
export async function firebaseConnCache(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const currentTime = Date.now();
  const coolTime = 10 * 60 * 1000; // 10분

  if (fbLastCheckTime && (currentTime - fbLastCheckTime < coolTime)) {
    globalLogger.info("Using cached Firebase connection");
    return next();
  }

  try {
    // 동적 import로 순환 참조 방지
    const { ConnectionStore } = await import("@/providers/firebase/store/connection");

    const conn = new ConnectionStore();
    const firestoreReady = await conn.getRecruitList();
    
    if (typeof firestoreReady === "string" && firestoreReady === conn.getConnectionCheckMessage()) {
      fbLastCheckTime = currentTime;
      createGlobalLogger('provider').debug("Firestore connection is alive.", "firebase");
      next();
    } else {
      next(new Error("Firestore connection check failed"));
    }
  } catch (error) {
    next(error);
  }
}

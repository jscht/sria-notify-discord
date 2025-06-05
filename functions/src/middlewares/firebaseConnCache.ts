import { Request, Response, NextFunction } from "express";
import { ConnectionStore } from "../providers/firebase/store/connection";

// redis로 변경
let fbLastCheckTime: number | null = null;

/**
 * @description 10분 간격 파이어베이스 연결 확인
 */
export async function firebaseConnCache(req: Request, res: Response, next: NextFunction) {
  const currentTime = Date.now();

  const coolTime = 10 * 60 * 1000; // 10분

  if (fbLastCheckTime && (currentTime - fbLastCheckTime < coolTime)) {
    DebugLogger.server("Using cached connection");
    return next();
  }

  const conn = new ConnectionStore;
  const firestoreReady = await conn.getRecruitList();
  
  if (typeof firestoreReady === "string" && firestoreReady === conn.getConnectionCheckMessage()) {
    fbLastCheckTime = currentTime;
    DebugLogger.provider("Firestore connection is alive.", "firebase");
    next();
  } else {
    next(new Error("Firestore connection failed"));
  }
}
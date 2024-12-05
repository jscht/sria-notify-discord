import { Request, Response, NextFunction } from "express";
import { checkFirebaseConnection } from "../providers/firebase";

// redis로 변경
let fbLastCheckTime: number | null = null;

/**
 * @description 10분 간격 파이어베이스 연결 확인
 */
export async function firebaseConnCache(req: Request, res: Response, next: NextFunction) {
  const currentTime = Date.now();
  // 10분
  const coolTime = 10 * 60 * 1000;
  if (fbLastCheckTime && (currentTime - fbLastCheckTime < coolTime)) {
    DebugLogger.server("Using cached connection");
    return next();
  }

  const firestoreReady = await checkFirebaseConnection();

  if (firestoreReady) {
    fbLastCheckTime = currentTime;
    DebugLogger.provider("Firestore connection successful", "firebase");
    return next();
  } else {
    DebugLogger.error("Firestore connection failed");
    return res.status(500).send("Firestore connection failed");
  }
}

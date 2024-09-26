import { Request, Response, NextFunction } from "express";
import { logger } from "firebase-functions";
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
    logger.info("Using cached connection");
    console.log("Using cached connection");
    return next();
  }

  const firestoreReady = await checkFirebaseConnection();

  if (firestoreReady) {
    fbLastCheckTime = currentTime;
    return next();
  } else {
    console.error("Firestore connection failed");
    return res.status(500).send("Firestore connection failed");
  }
}

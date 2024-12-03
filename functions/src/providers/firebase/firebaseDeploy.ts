import { Express } from "express";
import { onRequest } from "firebase-functions/v2/https";

export function firebaseDeploy(app: Express) {
  try {
    return onRequest({ 
      region: "asia-northeast3",
      memory: "1GiB", // 크롤링 작업은 메모리 소모가 큼
      timeoutSeconds: 180
    }, app);
    // 바로 크롤링을 해버릴까?
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error(error.message, error);
    }
    throw error;
  }
}

import { Express } from "express";
import { onRequest } from "firebase-functions/v2/https";

export function firebaseDeploy(app: Express) {
  try {
    return onRequest({
      region: "asia-northeast3",
      memory: "1GiB",
      timeoutSeconds: 180,
    }, app);
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error(error.message, error);
    }
    throw error;
  }
}

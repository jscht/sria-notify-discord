import { Express } from "express";
import { onRequest } from "firebase-functions/v2/https";

// Start writing functions
export function initFirebaseApp(app: Express) {
  return onRequest({ region: "asia-northeast3" }, app);
}

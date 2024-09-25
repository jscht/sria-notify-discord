import { Express } from "express";
import { onRequest } from "firebase-functions/v2/https";

export function firebaseDeploy(app: Express) {
  return onRequest({ region: "asia-northeast3" }, app);
}

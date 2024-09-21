import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

// Start writing functions
function firebaseApp(app: any) {
  return onRequest({ region: "asia-northeast3" }, app);
}

export { firebaseApp, logger };

import dotenv from "dotenv";
dotenv.config();
import "./utils/logger";
import { initExpress } from "./server/express";
import { firebaseDeploy } from "./providers/firebase";

const expressApp = initExpress();
const appServer = firebaseDeploy(expressApp);

if (!appServer) {
  DebugLogger.error("App server failed to start. Exiting express process.");
  process.exit(1);
}

export default appServer;

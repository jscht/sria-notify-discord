import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/logger";
import { initExpress } from "./express";
import { firebaseDeploy } from "@/providers/firebase";

const expressApp = initExpress();
const appServer = firebaseDeploy(expressApp);

if (!appServer) {
  globalLogger.error("App server failed to start. Exiting express process.");
  process.exit(1);
}

export default appServer;

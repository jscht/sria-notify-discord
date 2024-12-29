import dotenv from "dotenv";
dotenv.config();
import "./utils/logger";
import { initializeProviders } from "./providers";
import { initExpress } from "./server/express";
import { firebaseDeploy } from "./providers/firebase";
import { runScraper } from "./crawlers/sriagent";

initializeProviders()
.then(() => runScraper())
.catch((error) => {
  DebugLogger.error('Error during initialization or scraping:', error);
});

const expressApp = initExpress();
const appServer = firebaseDeploy(expressApp);

if (!appServer) {
  DebugLogger.error("App server failed to start. Exiting express process.");
  process.exit(1);
}

export default appServer;

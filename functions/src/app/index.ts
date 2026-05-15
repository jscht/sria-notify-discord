import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { initExpress } from "./express";
import { firebaseDeploy } from "@/providers/firebase";
import { initializeProviders } from "@/providers";

// 모듈 로드 시점에 즉시 init 시작 (로컬 emulator 부팅 / 프로덕션 cold start).
// initializeProviders()는 메모이즈되어 있어 미들웨어가 다시 호출해도
// 같은 promise를 await할 뿐 중복 실행되지 않는다.
initializeProviders().catch((error) => {
  globalLogger.error("Eager provider initialization failed:", error);
});

const expressApp = initExpress();
const appServer = firebaseDeploy(expressApp);

if (!appServer) {
  globalLogger.error("App server failed to start. Exiting express process.");
  process.exit(1);
}

export default appServer;

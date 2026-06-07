import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initExpress } from "./express";
import { firebaseDeploy } from "@/providers/firebase";
import { initializeProviders } from "@/providers";

// 최후의 거름망(A): init 중 발생하는 미처리 rejection/예외도 잡도록 가장 먼저 등록한다.
registerGlobalErrorHandlers();

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

// TODO(refactor): `export default`를 named export로 마이그레이션.
//   현재 함수가 emulator/배포 시 `default`라는 이름으로 등록되어 URL이
//   `.../asia-northeast3/default` 형태로 어색함. named로 바꾸면 깔끔하고
//   Firebase 공식 컨벤션에도 부합.
//   예) `export const api = appServer;`  → URL: `.../asia-northeast3/api`
//   주의: 배포된 함수가 이미 외부에서 호출 중이면 URL 변경으로 사용처 영향.
//   기간 동안 `default`/`api` 둘 다 export하는 alias 마이그레이션 필요.
export default appServer;

import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { bootstrapGateway } from "./bootstrapGateway";
import { initExpress } from "./express";
import { firebaseDeploy } from "@/providers/firebase";

// ⚠️ E안(하이브리드) 전환 이후 — 이 모듈은 Firebase Functions에 **더 이상 배포되지 않는다**.
//   package.json `main`이 `lib/app/scheduler.js`로 바뀌어, Functions는 스케줄 트리거
//   (recruitSchedule_sria / recruitSchedule_temp)만 배포한다. 즉 기존 onRequest(`default`)
//   HTTP 함수는 의도적으로 Functions에서 제거되었다(E안 설계상 정상).
//   게이트웨이(인터랙션 수신)는 이제 standalone 엔트리 `app/gateway.ts`(pm2 + VM)가 담당한다.
//   본 파일은 참조/로컬 호환 목적으로 유지한다. 부트스트랩은 `bootstrapGateway`로 공유.
bootstrapGateway();

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

import express from "express";
import initializeWorker from "../middlewares/initializeWorker";
import pageNotFound from "../middlewares/pageNotFound";
import errorHandler from "../middlewares/errorHandler";
// import { firebaseConnCache } from "../middlewares/firebaseConnCache";
// import { discordConnCache } from "../middlewares/discordConnCache";
import { recruitRouter } from "../routers/recruitRouter";
import { testRouter } from "../routers/test";

// 서버 실행 -> 파이어베이스 서버/데이터베이스, 레디스, 디스코드 서버 연결 확인

export function initExpress() {
  const app = express();

  app.use(initializeWorker);

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // app.use(firebaseConnCache);
  // app.use(discordConnCache);

  app.use("/api", recruitRouter);
  app.use("/test", testRouter);

  // catch 404 and forward to error handler
  app.use(pageNotFound);

  // error handler
  app.use(errorHandler);

  return app;
}

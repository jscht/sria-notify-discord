import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { firebaseDeploy, initFirebaseApp } from "./providers/firebase";
import { crawlRouter } from "./routers/crawlRouter";
import { firebaseConnCache } from "./middlewares/firebaseConnCache";
import pageNotFound from "./middlewares/pageNotFound";
import errorHandler from "./middlewares/errorHandler";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(firebaseConnCache);
// app.use(discordConnCache);
app.use("/api", crawlRouter);

// catch 404 and forward to error handler
app.use(pageNotFound);

// error handler
app.use(errorHandler);

// 서버 실행 -> 파이어베이스 서버/데이터베이스 연결 확인, 디스코드 서버 연결 확인
initFirebaseApp();
export const appServer = firebaseDeploy(app);

import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { firebaseApp } from "./providers/firebase";
import { crawlRouter } from "./routers/crawlRouter";
import pageNotFound from "./middlewares/pageNotFound";
import errorHandler from "./middlewares/errorHandler";
import { requestCrawling } from "./crawl";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 데이터 추출 작업 필요
requestCrawling();

// 지속적으로(약 10분?) 파베, 디코 서버 연결 확인 미들웨어 
// 확인 후 일정시간 동안 확인 안하고 넘기도록 -> 캐시 데이터가 있어야 할 듯?
// app.use(checkFirebaseConnection)
// app.use(checkDiscordConnection)
app.use("/api", crawlRouter);

// catch 404 and forward to error handler
app.use(pageNotFound);

// error handler
app.use(errorHandler);

// 서버 실행 -> 파이어베이스 서버/데이터베이스 연결 확인, 디스코드 서버 연결 확인
export const appServer = firebaseApp(app);

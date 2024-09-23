import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { initFirebaseApp } from "./providers/firebase";
import { crawlRouter } from "./routers/crawlRouter";
import pageNotFound from "./middlewares/pageNotFound";
import errorHandler from "./middlewares/errorHandler";
// import { firebaseConnCache } from "./middlewares/firebaseConnCache";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 지속적으로(약 10분?) 파베, 디코 서버 연결 확인 미들웨어 
// app.use(firebaseConnCache);
// app.use(discordConnCache);
app.use("/api", crawlRouter);

// catch 404 and forward to error handler
app.use(pageNotFound);

// error handler
app.use(errorHandler);

// 서버 실행 -> 파이어베이스 서버/데이터베이스 연결 확인, 디스코드 서버 연결 확인
export const appServer = initFirebaseApp(app);

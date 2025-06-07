import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../types/responseHandler.d";

export default function errorHandler(
  err: ResponseHandler, req: Request, res: Response, next: NextFunction
) {
  // error logger
  const { status, message } = err;
  DebugLogger.error(`Error code ${status || 500}: ${message}`);

  // set locals, only providing error in development
  const isDev = req.app.get("env") === "development";
  res.locals.message = isDev ? message : "Internal Server Error";
  res.locals.error = isDev ? err : {};

  if (status === 429) {
    res.status(status).set("Retry-After", "600").json({ err, message });
  }

  let msg = err.name ? err.name : message; // 에러 반환이 좀 꼬여있음
  res.status(status || 500).json({ err, message: msg });
}
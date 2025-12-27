/**
 * Express Error Handler Middleware
 * 에러 응답 처리
 */

import type { Request, Response, NextFunction } from "express";
import type { ResponseHandler } from "../types";

export default function errorHandler(
  err: ResponseHandler,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // error logger
  const { status = 500, message } = err;
  DebugLogger.error(`Error code ${status}: ${message}`);

  // set locals, only providing error in development
  const isDev = req.app.get("env") === "development";
  res.locals.message = isDev ? message : "Internal Server Error";
  res.locals.error = isDev ? err : {};

  if (status === 429) {
    res.status(status).set("Retry-After", "600").json({ err, message });
    return;
  }

  const msg = err.name ? err.name : message;  // 에러 반환이 좀 꼬여있음
  res.status(status).json({ err, message: msg });
}

import { Request, Response, NextFunction } from "express";
import { ResponseHandler } from "../types/responseHandler.d";

export default function errorHandler(
  err: ResponseHandler, req: Request, res: Response, next: NextFunction
) {
  // error logger
  const { status, message } = err;
  DebugLogger.error(`Error code ${status}: ${message}`);

  // set locals, only providing error in development
  const isDev = req.app.get("env") === "development";
  res.locals.message = isDev ? message : "Internal Server Error";
  res.locals.error = isDev ? err : {};

  res.status(status || 500).json({ status, message });
}

/**
 * Express Error Handler Middleware
 * 에러 응답 처리
 */

import type { Request, Response, NextFunction } from "express";
import type { ResponseHandler } from "../types";
import { formatDate } from "../utils";

interface ErrorResponse {
  success: false;
  error: {
    status: number;
    message: string;
    name?: string;
    stack?: string;
    timestamp: string;
    path: string;
    method: string;
  };
}

export default function errorHandler(
  err: ResponseHandler & { stack?: string },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { status = 500, message, name } = err;
  const isDev = req.app.get("env") === "development";
  const timestamp = formatDate(new Date().toISOString());

  // 개발자용 상세 로그
  console.error("\n" + "=".repeat(60));
  console.error(`❌ [ERROR] ${timestamp}`);
  console.error("=".repeat(60));
  console.error(`📍 Path: ${req.method} ${req.originalUrl}`);
  console.error(`📊 Status: ${status}`);
  console.error(`📝 Message: ${message}`);
  
  if (name) {
    console.error(`🏷️  Name: ${name}`);
  }
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.error(`📦 Body: ${JSON.stringify(req.body, null, 2)}`);
  }
  
  if (req.query && Object.keys(req.query).length > 0) {
    console.error(`🔍 Query: ${JSON.stringify(req.query)}`);
  }

  if (err.stack) {
    console.error(`\n📚 Stack Trace:\n${err.stack}`);
  }
  
  console.error("=".repeat(60) + "\n");

  // DebugLogger에도 기록
  DebugLogger.error(`[${status}] ${req.method} ${req.originalUrl} - ${message}`, err as Error);

  // 429 Too Many Requests 처리
  if (status === 429) {
    res.status(status).set("Retry-After", "600").json({
      success: false,
      error: {
        status,
        message: message || "Too many requests. Please try again later.",
        timestamp,
        path: req.originalUrl,
        method: req.method,
      },
    } as ErrorResponse);
    return;
  }

  // 응답 구성
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      status,
      message: message || "Internal Server Error",
      name: name || undefined,
      timestamp,
      path: req.originalUrl,
      method: req.method,
      // 개발 환경에서만 스택 트레이스 포함
      ...(isDev && err.stack && { stack: err.stack }),
    },
  };

  res.status(status).json(errorResponse);
}

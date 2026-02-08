/**
 * Express Error Handler Middleware
 * 에러 응답 처리 (SystemError 통합)
 */

import type { Request, Response, NextFunction } from "express";
import type { ResponseHandler } from "../types";
import { formatDate } from "../utils";
import { SystemError, ErrorCategory, emitSystemErrorEvent } from "../utils";

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
    category?: string;
    level?: string;
  };
}

export default function errorHandler(
  err: (ResponseHandler & { stack?: string }) | SystemError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = (err as ResponseHandler).status || 500;
  const message = (err as ResponseHandler).message || err.message || "Internal Server Error";
  const name = (err as ResponseHandler).name;
  const isDev = req.app.get("env") === "development";
  const timestamp = formatDate(new Date().toISOString());

  // SystemError를 EventBus로 발행 (HTTP 에러는 제외)
  if (err instanceof SystemError) {
    emitSystemErrorEvent(err);
  } else if (status >= 500) {
    // 500번대 에러는 SystemError로 변환하여 이벤트 발행
    const systemError = SystemError.wrap(err as Error, message || "Internal Server Error", {
      category: ErrorCategory.UNKNOWN,
      context: {
        path: req.originalUrl,
        method: req.method,
        status,
      },
    });
    emitSystemErrorEvent(systemError);
  }

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

  if (err instanceof SystemError) {
    console.error(`🏷️  Category: ${err.category}`);
    console.error(`📊 Level: ${err.level}`);
    if (err.context) {
      console.error(`📦 Context: ${JSON.stringify(err.context, null, 2)}`);
    }
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

  // globalLogger에도 기록 (DebugLogger 대신)
  globalLogger.error(`[${status}] ${req.method} ${req.originalUrl} - ${message}`, err as Error);

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
      // SystemError 추가 정보
      ...(err instanceof SystemError && {
        category: err.category,
        level: err.level,
      }),
      // 개발 환경에서만 스택 트레이스 포함
      ...(isDev && err.stack && { stack: err.stack }),
    },
  };

  res.status(status).json(errorResponse);
}

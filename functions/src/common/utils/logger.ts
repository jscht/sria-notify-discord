/**
 * Logger Utility
 * 애플리케이션 전역 로깅 시스템
 */

import { formatDate } from "./formatDate";

type LogLevel = "info" | "debug" | "warn" | "error";
type LogSource = string; // 순환 참조 방지

interface LogHandler {
  level: LogLevel;
  source: LogSource;
  message: string;
}

class Logger {
  private readonly DEDUP_TTL = 60;

  private static log(log: LogHandler): void {
    const timestamp = formatDate(new Date());
    const logLine = `[${timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;

    const refLogMessage = `For detailed logs, please check: ${process.env.LOG_REF_URL || "console"}`;

    switch (log.level) {
      case "info":
        console.info(logLine, refLogMessage);
        break;
      case "debug":
        console.debug(logLine, refLogMessage);
        break;
      case "warn":
        console.warn(logLine, refLogMessage);
        break;
      case "error":
        console.error(logLine, refLogMessage);
        break;
    }
  }

  // Application Log Group
  static server = (message: string): void => {
    const log = `[app:server] ${message}`;
    console.info(log);
  };

  static request = (message: string): void => {
    const log = `[app:request] ${message}`;
    console.info(log);
  };

  // Application Process Debugging Log Group
  static crawler = (message: string, data?: any): void => {
    const log = `[debug:crawler] ${message}`;
    if (!data) {
      console.debug(log);
    } else {
      console.debug(log, data);
    }
  };

  static provider = (message: string, provider: string): void => {
    const log = `[debug:provider:${provider}] ${message}`;
    console.debug(log);
  };

  // Application Error, Failure Log Group
  static error = (message: string, error?: Error): void => {
    const log = `[error:server] ${message}`;
    if (!error) {
      console.error(log);
    } else {
      console.error(log, error?.message);
    }
  };

  static fail = (message: string): void => {
    const log = `[error:request] ${message}`;
    console.error(log);
  };

  static warn = (message: string): void => {
    const log = `[warn:request] ${message}`;
    console.warn(log);
  };
}

// 전역 Logger 타입 확장
declare global {
  var DebugLogger: typeof Logger;
}

global.DebugLogger = Logger;

export default Logger;

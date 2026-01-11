/**
 * System Logger
 *
 * 구조화된 로깅을 지원하는 시스템 로거
 * 기존 Logger를 감싸서 확장하며, 이벤트 시스템 등에서 사용
 */

import Logger from "./logger";
import { formatDate } from "./formatDate";

/**
 * 로그 레벨
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * 로그 컨텍스트 인터페이스
 * 추가 메타데이터를 구조화된 형태로 전달
 */
export interface LogContext {
  [key: string]: any;
}

/**
 * 구조화된 로그 엔트리
 */
interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * 로그 색상 코드
 */
const LogColors = {
  DEBUG: "\x1b[35m",   // Magenta
  INFO: "\x1b[36m",    // Cyan
  SUCCESS: "\x1b[32m", // Green
  WARN: "\x1b[33m",    // Yellow
  ERROR: "\x1b[31m",   // Red
  RESET: "\x1b[0m",    // Reset
  DIM: "\x1b[2m",      // Dim
  BOLD: "\x1b[1m",     // Bold
} as const;

/**
 * SystemLogger 클래스
 *
 * 기존 Logger를 확장하여 구조화된 로깅 제공
 */
export class SystemLogger {
  constructor(private readonly source: string) {}

  /**
   * 구조화된 로그 엔트리 생성
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: formatDate(new Date()),
      level,
      source: this.source,
      message,
    };

    if (context) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  /**
   * 로그 엔트리를 포맷팅하여 출력
   */
  private formatLogEntry(entry: StructuredLogEntry): string {
    const levelColor = this.getLevelColor(entry.level);
    const levelStr = entry.level.toUpperCase().padEnd(5);

    let output = `${LogColors.DIM}${entry.timestamp}${LogColors.RESET} ${levelColor}${levelStr}${LogColors.RESET} ${LogColors.BOLD}[${entry.source}]${LogColors.RESET} ${entry.message}`;

    // 컨텍스트가 있으면 추가
    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n${LogColors.DIM}Context: ${JSON.stringify(entry.context, null, 2)}${LogColors.RESET}`;
    }

    // 에러가 있으면 추가
    if (entry.error) {
      output += `\n${LogColors.ERROR}Error: ${entry.error.name} - ${entry.error.message}${LogColors.RESET}`;
      if (entry.error.stack) {
        output += `\n${LogColors.DIM}${entry.error.stack}${LogColors.RESET}`;
      }
    }

    return output;
  }

  /**
   * 로그 레벨에 따른 색상 반환
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return LogColors.DEBUG;
      case LogLevel.INFO:
        return LogColors.INFO;
      case LogLevel.WARN:
        return LogColors.WARN;
      case LogLevel.ERROR:
        return LogColors.ERROR;
      default:
        return LogColors.RESET;
    }
  }

  /**
   * 로그 출력 (레벨에 따라 적절한 console 메서드 사용)
   */
  private output(entry: StructuredLogEntry): void {
    const formatted = this.formatLogEntry(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }
  }

  /**
   * DEBUG 레벨 로그
   */
  debug(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.output(entry);
  }

  /**
   * INFO 레벨 로그
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.output(entry);
  }

  /**
   * SUCCESS 로그 (INFO 레벨에 녹색 표시)
   */
  success(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    const formatted = `${LogColors.DIM}${entry.timestamp}${LogColors.RESET} ${LogColors.SUCCESS}INFO ${LogColors.RESET} ${LogColors.BOLD}[${entry.source}]${LogColors.RESET} ${message}`;

    if (context && Object.keys(context).length > 0) {
      console.info(`${formatted}\n${LogColors.DIM}Context: ${JSON.stringify(context, null, 2)}${LogColors.RESET}`);
    } else {
      console.info(formatted);
    }
  }

  /**
   * WARN 레벨 로그
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.output(entry);
  }

  /**
   * ERROR 레벨 로그
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
    this.output(entry);
  }

  /**
   * 측정 시작 (성능 측정용)
   */
  startTimer(label: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed`, { duration: `${duration}ms` });
    };
  }

  /**
   * 새로운 소스로 로거 생성
   */
  child(childSource: string): SystemLogger {
    return new SystemLogger(`${this.source}:${childSource}`);
  }
}

/**
 * 팩토리 함수
 */
export function createLogger(source: string): SystemLogger {
  return new SystemLogger(source);
}

/**
 * 기본 시스템 로거 인스턴스
 */
export const systemLogger = createLogger("system");

/**
 * 전역 로거 등록
 */
if (typeof global !== "undefined") {
  (global as any).globalLogger = systemLogger;
  (global as any).createGlobalLogger = createLogger;
}

/**
 * Logger Utility
 *
 * 레거시 호환성을 위한 간단한 로깅 시스템
 * 새로운 코드에서는 SystemLogger 사용을 권장합니다.
 */

import { createLogger } from "./systemLogger";

/**
 * Logger 클래스
 *
 * @deprecated SystemLogger 사용을 권장합니다.
 */
class Logger {
  // Application Log Group
  static server = (message: string): void => {
    const logger = createLogger("server");
    logger.info(message);
  };

  static request = (message: string): void => {
    const logger = createLogger("request");
    logger.info(message);
  };

  // Application Process Debugging Log Group
  static crawler = (message: string, data?: any): void => {
    const logger = createLogger("crawler");
    logger.debug(message, data ? { data } : undefined);
  };

  static provider = (message: string, provider: string): void => {
    const logger = createLogger(`provider:${provider}`);
    logger.debug(message);
  };

  // Application Error, Failure Log Group
  static error = (message: string, error?: Error): void => {
    const logger = createLogger("server");
    logger.error(message, error);
  };

  static fail = (message: string): void => {
    const logger = createLogger("request");
    logger.error(message);
  };

  static warn = (message: string): void => {
    const logger = createLogger("request");
    logger.warn(message);
  };
}

/**
 * 전역 DebugLogger 등록 (레거시 호환성)
 *
 * @deprecated Phase 1.11 이후 globalLogger 사용으로 마이그레이션 완료
 * 하위 호환성을 위해서만 유지합니다.
 */
if (typeof global !== "undefined") {
  (global as any).DebugLogger = Logger;
}

export default Logger;

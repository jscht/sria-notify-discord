/**
 * Global Type Definitions
 */

import type { SystemLogger, createLogger } from "../utils/systemLogger";

declare global {
  /**
   * 전역 SystemLogger 인스턴스
   *
   * @example
   * ```typescript
   * // 전역에서 바로 사용
   * globalLogger.info('서버 시작');
   * globalLogger.error('에러 발생', error);
   *
   * // 또는 createLogger로 새 로거 생성
   * const logger = createGlobalLogger('MyService');
   * logger.info('작업 시작');
   * ```
   */
  var globalLogger: SystemLogger;

  /**
   * 전역 createLogger 함수
   *
   * @example
   * ```typescript
   * const logger = createGlobalLogger('MyService');
   * logger.info('서비스 시작', { port: 3000 });
   * ```
   */
  var createGlobalLogger: typeof createLogger;
}

export {};

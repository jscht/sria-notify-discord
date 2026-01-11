/**
 * Event Logger
 *
 * EventBus 전용 로깅 유틸리티
 * 이벤트 발행, 구독, 핸들러 실행 등을 추적
 */

import { createLogger, type LogContext } from "@/common/utils/systemLogger";
import type { EventType } from "../types";

/**
 * EventBus 전용 로거
 */
const logger = createLogger("EventBus");

/**
 * 이벤트 로깅 유틸리티
 */
export const eventLogger = {
  /**
   * 이벤트 발행 로그
   */
  emitted(event: EventType, hasListeners: boolean, context?: LogContext): void {
    const emoji = hasListeners ? "📤" : "📭";
    const status = hasListeners ? "emitted" : "emitted (no listeners)";

    logger.debug(`${emoji} Event ${status}: ${event}`, {
      event,
      hasListeners,
      ...context,
    });
  },

  /**
   * 이벤트 리스너 등록 로그
   */
  listenerAdded(event: EventType, listenerCount: number): void {
    logger.debug(`👂 Listener registered: ${event}`, {
      event,
      totalListeners: listenerCount,
    });
  },

  /**
   * 이벤트 리스너 제거 로그
   */
  listenerRemoved(event: EventType, listenerCount: number): void {
    logger.debug(`🔇 Listener removed: ${event}`, {
      event,
      remainingListeners: listenerCount,
    });
  },

  /**
   * 모든 리스너 제거 로그
   */
  allListenersRemoved(event: EventType): void {
    logger.debug(`🔕 All listeners removed: ${event}`, { event });
  },

  /**
   * 핸들러 실행 시작 로그
   */
  handlerStarted(event: EventType, handlerName?: string): () => void {
    const start = Date.now();
    const name = handlerName || "anonymous";

    logger.debug(`⚙️  Handler started: ${name} for ${event}`, {
      event,
      handler: name,
    });

    // 타이머 함수 반환
    return () => {
      const duration = Date.now() - start;
      logger.debug(`✅ Handler completed: ${name} for ${event}`, {
        event,
        handler: name,
        duration: `${duration}ms`,
      });
    };
  },

  /**
   * 핸들러 실행 실패 로그
   */
  handlerFailed(
    event: EventType,
    error: Error,
    handlerName?: string,
    context?: LogContext
  ): void {
    const name = handlerName || "anonymous";

    logger.error(`❌ Handler failed: ${name} for ${event}`, error, {
      event,
      handler: name,
      ...context,
    });
  },

  /**
   * 핸들러 타임아웃 경고
   */
  handlerTimeout(
    event: EventType,
    duration: number,
    handlerName?: string
  ): void {
    const name = handlerName || "anonymous";

    logger.warn(`⏱️  Handler timeout warning: ${name} for ${event}`, {
      event,
      handler: name,
      duration: `${duration}ms`,
      threshold: "30000ms",
    });
  },

  /**
   * 핸들러 등록 완료 로그
   */
  handlersRegistered(handlerCount: number): void {
    logger.success(`🎉 All event handlers registered successfully`, {
      totalHandlers: handlerCount,
    });
  },

  /**
   * 핸들러 등록 스킵 로그
   */
  handlersAlreadyRegistered(): void {
    logger.info(`⏭️  Event handlers already registered, skipping...`);
  },

  /**
   * EventBus 초기화 로그
   */
  busInitialized(): void {
    logger.info(`🚌 EventBus initialized`);
  },

  /**
   * 커스텀 이벤트 로그
   */
  custom(message: string, context?: LogContext): void {
    logger.info(message, context);
  },

  /**
   * 커스텀 에러 로그
   */
  customError(message: string, error: Error, context?: LogContext): void {
    logger.error(message, error, context);
  },
};

/**
 * 이벤트 핸들러 래퍼
 * 자동으로 로깅과 에러 처리를 추가
 */
export function withEventLogging<T>(
  event: EventType,
  handler: (payload: T) => void | Promise<void>,
  handlerName?: string
): (payload: T) => Promise<void> {
  return async (payload: T) => {
    const stopTimer = eventLogger.handlerStarted(event, handlerName);

    try {
      await handler(payload);
      stopTimer();
    } catch (error) {
      stopTimer();
      eventLogger.handlerFailed(
        event,
        error as Error,
        handlerName,
        { payload }
      );
      throw error; // 에러는 다시 던져서 상위에서 처리하도록
    }
  };
}

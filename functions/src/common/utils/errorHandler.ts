/**
 * Error Handler Utilities
 *
 * 에러 처리를 위한 유틸리티 함수들
 */

import { SystemError, ErrorLevel, ErrorCategory } from "./systemError";
import { createLogger } from "./systemLogger";
import { eventBus } from "@/eventBus/EventBus";
import { EventType } from "@/eventBus/types";

const logger = createLogger("ErrorHandler");

/**
 * 에러 핸들러 옵션
 */
interface ErrorHandlerOptions {
  /** 에러를 EventBus로 발행할지 여부 (기본값: true) */
  emitEvent?: boolean;
  /** 에러 재발생 여부 (기본값: false) */
  rethrow?: boolean;
  /** 폴백 함수 (에러 발생 시 실행) */
  fallback?: () => void | Promise<void>;
}

/**
 * 비동기 함수를 감싸서 에러 처리를 자동화
 *
 * @example
 * ```typescript
 * const result = await withErrorHandler(
 *   async () => {
 *     return await fetchData();
 *   },
 *   {
 *     category: ErrorCategory.EXTERNAL_API,
 *     message: "데이터 페칭 실패",
 *     fallback: () => console.log("폴백 실행")
 *   }
 * );
 * ```
 */
export async function withErrorHandler<T>(
  fn: () => Promise<T>,
  config: {
    category: ErrorCategory;
    message: string;
    level?: ErrorLevel;
    context?: Record<string, any>;
  } & ErrorHandlerOptions
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const systemError = SystemError.wrap(error, config.message, {
      level: config.level || ErrorLevel.FAILURE,
      category: config.category,
      context: config.context,
    });

    // 이벤트 발행 (기본값: true)
    if (config.emitEvent !== false) {
      emitSystemErrorEvent(systemError);
    }

    // 폴백 실행
    if (config.fallback) {
      try {
        await config.fallback();
      } catch (fallbackError) {
        logger.error("폴백 함수 실행 실패", fallbackError as Error);
      }
    }

    // 에러 재발생
    if (config.rethrow) {
      throw systemError;
    }

    return undefined;
  }
}

/**
 * SystemError를 EventBus로 발행
 */
export function emitSystemErrorEvent(error: SystemError): void {
  // ErrorLevel과 EventType 완전 매핑
  let eventType: EventType;

  switch (error.level) {
    case ErrorLevel.CRITICAL:
      eventType = EventType.SYSTEM_ERROR_CRITICAL;
      break;
    case ErrorLevel.FAILURE:
      eventType = EventType.SYSTEM_ERROR_FAILURE;
      break;
    case ErrorLevel.WARNING:
      eventType = EventType.SYSTEM_ERROR_WARNING;
      break;
    default:
      eventType = EventType.SYSTEM_ERROR_FAILURE;
  }

  try {
    eventBus.emitEvent(eventType, {
      timestamp: error.timestamp.toISOString(),
      error: error.toJSON(),
    });
  } catch (emitError) {
    logger.error("시스템 에러 이벤트 발행 실패", emitError as Error, {
      originalError: error.message,
    });
  }
}

/**
 * 알 수 없는 에러를 SystemError로 정규화
 */
export function normalizeError(
  error: unknown,
  defaultMessage: string = "알 수 없는 에러 발생"
): SystemError {
  if (error instanceof SystemError) {
    return error;
  }

  if (error instanceof Error) {
    return SystemError.wrap(error, error.message || defaultMessage);
  }

  // 문자열 에러
  if (typeof error === "string") {
    return new SystemError(error || defaultMessage);
  }

  // 기타 에러
  return new SystemError(defaultMessage, {
    context: { rawError: error },
  });
}

/**
 * 재시도 로직을 포함한 에러 핸들러
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await fetchData(),
 *   {
 *     maxRetries: 3,
 *     retryDelay: 1000,
 *     category: ErrorCategory.EXTERNAL_API,
 *     message: "데이터 페칭 실패"
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: {
    maxRetries: number;
    retryDelay: number;
    category: ErrorCategory;
    message: string;
    shouldRetry?: (error: unknown) => boolean;
  } & ErrorHandlerOptions
): Promise<T | undefined> {
  let lastError: unknown;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // 재시도 여부 확인
      const shouldRetry = config.shouldRetry ? config.shouldRetry(error) : true;

      if (!shouldRetry || attempt > config.maxRetries) {
        break;
      }

      logger.warn(`재시도 ${attempt}/${config.maxRetries}`, {
        message: config.message,
        delay: config.retryDelay,
      });

      // 재시도 대기
      await new Promise((resolve) => setTimeout(resolve, config.retryDelay));
    }
  }

  // 모든 재시도 실패
  const systemError = SystemError.wrap(lastError, `${config.message} (${attempt}회 재시도 실패)`, {
    category: config.category,
    context: {
      attempts: attempt,
      maxRetries: config.maxRetries,
    },
  });

  if (config.emitEvent !== false) {
    emitSystemErrorEvent(systemError);
  }

  if (config.fallback) {
    try {
      await config.fallback();
    } catch (fallbackError) {
      logger.error("폴백 함수 실행 실패", fallbackError as Error);
    }
  }

  if (config.rethrow) {
    throw systemError;
  }

  return undefined;
}

/**
 * Promise.all 래퍼 (개별 에러 처리)
 *
 * Promise.all과 달리 일부 실패해도 성공한 것들은 반환
 */
export async function allSettledWithErrors<T>(
  promises: Promise<T>[],
  config: {
    category: ErrorCategory;
    message: string;
  }
): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  const successResults: T[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successResults.push(result.value);
    } else {
      const error = SystemError.wrap(result.reason, `${config.message} (인덱스 ${index})`, {
        category: config.category,
        context: { index },
      });
      emitSystemErrorEvent(error);
    }
  });

  return successResults;
}

/**
 * 에러 경계 (Error Boundary) 래퍼
 *
 * 최상위 catch 블록으로 사용
 */
export async function errorBoundary<T>(
  fn: () => Promise<T>,
  config: {
    category: ErrorCategory;
    message: string;
    fallbackValue?: T;
  }
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const systemError = normalizeError(error, config.message);

    // 카테고리 오버라이드
    if (!(error instanceof SystemError)) {
      (systemError as any).category = config.category;
    }

    emitSystemErrorEvent(systemError);

    return config.fallbackValue;
  }
}

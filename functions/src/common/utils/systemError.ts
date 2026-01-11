/**
 * System Error Class
 *
 * 시스템 내부 에러를 위한 표준 에러 클래스
 * HttpError는 HTTP 응답용, SystemError는 내부 시스템 에러용
 */

import { createLogger } from "./systemLogger";

const logger = createLogger("SystemError");

/**
 * 에러 레벨 (심각도)
 */
export enum ErrorLevel {
  /** 경고 - 복구 가능한 에러, 문제 발생 가능성 */
  WARNING = "warning",
  /** 실패 - 기능 실패, 시스템은 계속 동작 */
  FAILURE = "failure",
  /** 치명적 - 시스템 동작 불가, 즉시 조치 필요 */
  CRITICAL = "critical",
}

/**
 * 에러 카테고리
 */
export enum ErrorCategory {
  /** 크롤러 관련 에러 */
  CRAWLER = "crawler",
  /** 데이터베이스 관련 에러 */
  DATABASE = "database",
  /** 외부 API 관련 에러 */
  EXTERNAL_API = "external_api",
  /** Discord API 관련 에러 */
  DISCORD_API = "discord_api",
  /** 이벤트 버스 관련 에러 */
  EVENT_BUS = "event_bus",
  /** 프록시 관련 에러 */
  PROXY = "proxy",
  /** 인증/권한 관련 에러 */
  AUTH = "auth",
  /** 검증 실패 */
  VALIDATION = "validation",
  /** 타임아웃 */
  TIMEOUT = "timeout",
  /** 알 수 없는 에러 */
  UNKNOWN = "unknown",
}

/**
 * 에러 컨텍스트 인터페이스
 */
export interface ErrorContext {
  [key: string]: any;
}

/**
 * SystemError 옵션
 */
interface SystemErrorOptions {
  /** 에러 레벨 (기본값: FAILURE) */
  level?: ErrorLevel;
  /** 에러 카테고리 (기본값: UNKNOWN) */
  category?: ErrorCategory;
  /** 추가 컨텍스트 정보 */
  context?: ErrorContext;
  /** 원본 에러 (래핑할 때 사용) */
  originalError?: Error;
  /** 복구 가능 여부 (기본값: false) */
  recoverable?: boolean;
}

/**
 * SystemError 클래스
 *
 * 시스템 내부 에러를 위한 표준화된 에러 클래스
 *
 * @example
 * ```typescript
 * // 기본 사용
 * throw new SystemError("크롤링 실패", {
 *   category: ErrorCategory.CRAWLER,
 *   level: ErrorLevel.ERROR,
 *   context: { url: "https://example.com" }
 * });
 *
 * // 에러 래핑
 * try {
 *   await fetchData();
 * } catch (error) {
 *   throw SystemError.wrap(error, "데이터 페칭 실패", {
 *     category: ErrorCategory.EXTERNAL_API
 *   });
 * }
 *
 * // 정적 팩토리 메서드 사용
 * throw SystemError.crawlerFailed("사람인 크롤링 실패", { provider: "saramin" });
 * throw SystemError.databaseError("Firestore 저장 실패", firestoreError);
 * throw SystemError.critical("프록시 서버 전체 불가");
 * ```
 */
export class SystemError extends Error {
  /** 에러 레벨 */
  public readonly level: ErrorLevel;

  /** 에러 카테고리 */
  public readonly category: ErrorCategory;

  /** 추가 컨텍스트 */
  public readonly context?: ErrorContext;

  /** 원본 에러 */
  public readonly originalError?: Error;

  /** 복구 가능 여부 */
  public readonly recoverable: boolean;

  /** 에러 발생 시각 */
  public readonly timestamp: Date;

  constructor(message: string, options: SystemErrorOptions = {}) {
    super(message);

    this.name = "SystemError";
    this.level = options.level || ErrorLevel.FAILURE;
    this.category = options.category || ErrorCategory.UNKNOWN;
    this.context = options.context;
    this.originalError = options.originalError;
    this.recoverable = options.recoverable || false;
    this.timestamp = new Date();

    // 에러 스택 트레이스 보존
    if (options.originalError && options.originalError.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.originalError.stack}`;
    }

    // 자동 로깅
    this.log();
  }

  /**
   * 에러 로깅
   *
   * ErrorLevel에 따라 적절한 로그 레벨로 기록:
   * - CRITICAL → logger.error (🚨 이모지)
   * - FAILURE → logger.error (❌ 이모지)
   * - WARNING → logger.warn (⚠️ 이모지)
   */
  private log(): void {
    const logContext: ErrorContext = {
      level: this.level,
      category: this.category,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      ...this.context,
    };

    switch (this.level) {
      case ErrorLevel.CRITICAL:
        logger.error(`🚨 CRITICAL: ${this.message}`, this.originalError || this, logContext);
        break;
      case ErrorLevel.FAILURE:
        logger.error(`❌ ${this.message}`, this.originalError || this, logContext);
        break;
      case ErrorLevel.WARNING:
        logger.warn(`⚠️ ${this.message}`, logContext);
        break;
      default:
        logger.error(`❌ ${this.message}`, this.originalError || this, logContext);
    }
  }

  /**
   * 에러를 SystemError로 래핑
   */
  static wrap(
    error: unknown,
    message: string,
    options: Omit<SystemErrorOptions, "originalError"> = {}
  ): SystemError {
    const originalError = error instanceof Error ? error : new Error(String(error));

    return new SystemError(message, {
      ...options,
      originalError,
    });
  }

  /**
   * 크롤러 에러 생성
   */
  static crawlerFailed(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.CRAWLER,
      context,
      recoverable: true,
    });
  }

  /**
   * 데이터베이스 에러 생성
   */
  static databaseError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.DATABASE,
      originalError: error,
      context,
      recoverable: false,
    });
  }

  /**
   * 외부 API 에러 생성
   */
  static externalApiError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.EXTERNAL_API,
      originalError: error,
      context,
      recoverable: true,
    });
  }

  /**
   * Discord API 에러 생성
   */
  static discordApiError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.DISCORD_API,
      originalError: error,
      context,
      recoverable: true,
    });
  }

  /**
   * 이벤트 버스 에러 생성
   */
  static eventBusError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.EVENT_BUS,
      originalError: error,
      context,
      recoverable: false,
    });
  }

  /**
   * 프록시 에러 생성
   */
  static proxyError(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.CRITICAL,
      category: ErrorCategory.PROXY,
      context,
      recoverable: false,
    });
  }

  /**
   * 인증/권한 에러 생성
   */
  static authError(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.AUTH,
      context,
      recoverable: false,
    });
  }

  /**
   * 검증 에러 생성
   */
  static validationError(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.WARNING,
      category: ErrorCategory.VALIDATION,
      context,
      recoverable: true,
    });
  }

  /**
   * 타임아웃 에러 생성
   */
  static timeoutError(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.TIMEOUT,
      context,
      recoverable: true,
    });
  }

  /**
   * 치명적 에러 생성 (즉시 조치 필요)
   */
  static critical(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.CRITICAL,
      category: ErrorCategory.UNKNOWN,
      originalError: error,
      context,
      recoverable: false,
    });
  }

  /**
   * 경고 레벨 에러 생성
   */
  static warning(message: string, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.WARNING,
      category: ErrorCategory.UNKNOWN,
      context,
      recoverable: true,
    });
  }

  /**
   * JSON으로 직렬화
   */
  toJSON(): object {
    return {
      name: this.name,
      message: this.message,
      level: this.level,
      category: this.category,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }
}

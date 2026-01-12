/**
 * System Error Class
 *
 * 시스템 내부 에러를 위한 표준 에러 클래스
 * HttpError는 HTTP 응답용, SystemError는 내부 시스템 에러용
 */

import { createLogger } from "./systemLogger";
import type { CrawlerStrategyType } from "@/crawlers";
import { HttpError } from "./httpError";

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
  // Application Layer
  /** 크롤러 관련 에러 */
  CRAWLER = "crawler",
  /** 이벤트 버스 관련 에러 */
  EVENT_BUS = "event_bus",
  /** 인증/권한 관련 에러 */
  AUTH = "auth",
  /** 검증 실패 */
  VALIDATION = "validation",

  // Integration Layer - External Services
  /** Redis 캐시 에러 */
  REDIS = "redis",
  /** Firestore 데이터베이스 에러 */
  FIRESTORE = "firestore",
  /** Discord API 에러 */
  DISCORD_API = "discord_api",
  /** Hugging Face AI API 에러 */
  HUGGING_FACE = "hugging_face",

  // Infrastructure Layer
  /** Firebase 배포 관련 에러 */
  FIREBASE_DEPLOYMENT = "firebase_deployment",
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
 * 크롤러 에러 컨텍스트
 */
export interface CrawlerErrorContext extends ErrorContext {
  /** 크롤링 전략 (CrawlerStrategy 사용) */
  strategy: CrawlerStrategyType;
  /** 크롤링 제공자 (saramin, jobkorea 등) */
  provider?: string;
  /** 크롤링 URL */
  url?: string;
  /** HTTP 상태 코드 */
  statusCode?: number;
  /** 프록시 정보 */
  proxyUrl?: string;
  /** 재시도 횟수 */
  retryCount?: number;
  /** 타임아웃 시간 (ms) */
  timeout?: number;
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
 *   level: ErrorLevel.FAILURE,
 *   context: { url: "https://example.com" }
 * });
 *
 * // 에러 래핑
 * try {
 *   await fetchData();
 * } catch (error) {
 *   throw SystemError.wrap(error, "데이터 페칭 실패", {
 *     category: ErrorCategory.REDIS
 *   });
 * }
 *
 * // 정적 팩토리 메서드 사용 (Provider별)
 * import { CrawlerStrategy } from "@/crawlers";
 *
 * throw SystemError.crawlerFailed("사람인 크롤링 실패", {
 *   strategy: CrawlerStrategy.RECRUIT,  // 필수
 *   provider: "saramin",
 *   url: "https://example.com",
 *   statusCode: 503
 * });
 * throw SystemError.redisError("Redis 연결 실패", connectionError);
 * throw SystemError.firestoreError("Firestore 저장 실패", firestoreError);
 * throw SystemError.discordApiError("Discord 메시지 발송 실패", discordError);
 * throw SystemError.huggingFaceError("AI 모델 호출 실패", apiError);
 * throw SystemError.deploymentError("Functions 배포 실패", deployError, { stage: "predeploy" });
 *
 * // 네트워크 에러는 networkError()가 HttpError로 자동 변환
 * throw SystemError.networkError("서비스 일시 사용 불가", undefined, { statusCode: 503 });
 * throw SystemError.networkError("요청 타임아웃", timeoutError, { statusCode: 408 });
 * throw SystemError.networkError("게이트웨이 타임아웃", undefined, { statusCode: 504 });
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
  static crawlerFailed(message: string, context?: CrawlerErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.CRAWLER,
      context,
      recoverable: true,
    });
  }

  /**
   * Redis 캐시 에러 생성
   */
  static redisError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.REDIS,
      originalError: error,
      context,
      recoverable: true,
    });
  }

  /**
   * Firestore 데이터베이스 에러 생성
   */
  static firestoreError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.FIRESTORE,
      originalError: error,
      context,
      recoverable: false,
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
   * Hugging Face AI API 에러 생성
   */
  static huggingFaceError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.FAILURE,
      category: ErrorCategory.HUGGING_FACE,
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
   * Firebase 배포 에러 생성
   */
  static deploymentError(message: string, error?: Error, context?: ErrorContext): SystemError {
    return new SystemError(message, {
      level: ErrorLevel.CRITICAL,
      category: ErrorCategory.FIREBASE_DEPLOYMENT,
      originalError: error,
      context,
      recoverable: false,
    });
  }

  /**
   * 네트워크 에러 생성 (HttpError로 변환)
   *
   * HTTP 상태 코드를 기반으로 적절한 HttpError를 생성합니다.
   * statusCode가 없거나 알 수 없는 경우 500으로 처리됩니다.
   *
   * @param message - 에러 메시지
   * @param error - 원본 에러
   * @param context - 에러 컨텍스트 (statusCode 포함)
   * @returns HttpError 인스턴스
   */
  static networkError(
    message: string,
    error?: Error,
    context?: ErrorContext & { statusCode?: number }
  ): HttpError {
    const statusCode = context?.statusCode;

    // 알려진 HTTP 상태 코드에 대한 HttpError 생성
    switch (statusCode) {
      case 400:
        return HttpError.BadRequest(message);
      case 401:
        return HttpError.Unauthorized(message);
      case 403:
        return HttpError.Forbidden(message);
      case 404:
        return HttpError.NotFound(message);
      case 405:
        return HttpError.MethodNotAllowed(message);
      case 408:
        return HttpError.RequestTimeout(message);
      case 409:
        return HttpError.Conflict(message);
      case 422:
        return HttpError.UnprocessableContent(message);
      case 429:
        return HttpError.TooManyRequests(message);
      case 503:
        return HttpError.ServiceUnavailable(message);
      case 500:
        return HttpError.InternalServerError(message);
      default:
        // 알 수 없는 상태 코드이거나 statusCode가 없는 경우
        // 4xx 범위면 400, 5xx 범위면 500, 그 외는 500
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          return new HttpError(statusCode, message);
        } else if (statusCode && statusCode >= 500 && statusCode < 600) {
          return new HttpError(statusCode, message);
        } else {
          // statusCode가 없거나 HTTP 범위 밖이면 500으로 처리
          logger.warn(`⚠️ 알 수 없는 상태 코드: ${statusCode}, 500으로 처리`, {
            statusCode,
            message,
            originalError: error?.message,
          });
          return HttpError.InternalServerError(message);
        }
    }
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

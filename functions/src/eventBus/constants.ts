/**
 * EventBus 상수 정의
 *
 * 이벤트 시스템에서 사용하는 상수들을 정의합니다.
 */

/**
 * EventBus 설정 상수
 */
export const EVENT_BUS_CONFIG = {
  /**
   * 최대 리스너 수
   * 메모리 누수 경고를 방지하기 위한 설정
   */
  MAX_LISTENERS: 100,

  /**
   * 이벤트 타임아웃 (밀리초)
   * 이벤트 핸들러가 이 시간 내에 완료되지 않으면 경고 로그 출력
   */
  EVENT_TIMEOUT_MS: 30000,
} as const;

/**
 * 이벤트 도메인 상수
 */
export const EVENT_DOMAIN = {
  RECRUIT: 'recruit',
  NOTIFICATION: 'notification',
  ERROR: 'error',
  ADMIN: 'admin',
  PROXY: 'proxy',
} as const;

/**
 * 이벤트 액션 상수
 */
export const EVENT_ACTION = {
  // Recruit actions
  CRAWL_STARTED: 'crawl.started',
  CRAWL_COMPLETED: 'crawl.completed',
  CRAWL_FAILED: 'crawl.failed',
  NEW: 'new',
  REQUESTED: 'requested',
  REQUEST_COMPLETED: 'request.completed',

  // Notification actions
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  SEND: 'send',
  SENT: 'sent',

  // Error actions
  CRITICAL: 'critical',
  WARNING: 'warning',

  // Admin actions
  BROADCAST_REQUEST: 'broadcast.request',
  BROADCAST_SENT: 'broadcast.sent',

  // Proxy actions
  UNAVAILABLE: 'unavailable',
  REFRESH_STARTED: 'refresh.started',
  REFRESH_COMPLETED: 'refresh.completed',
  REFRESH_FAILED: 'refresh.failed',
} as const;

/**
 * 로그 레벨별 색상 코드
 */
export const LOG_COLORS = {
  INFO: '\x1b[36m',    // Cyan
  SUCCESS: '\x1b[32m', // Green
  WARNING: '\x1b[33m', // Yellow
  ERROR: '\x1b[31m',   // Red
  RESET: '\x1b[0m',    // Reset
} as const;

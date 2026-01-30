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
 * 
 * @description 주요 4개 도메인 (Recruit, Notification, SystemError, Admin)
 * - Recruit: 채용 공고 크롤링 및 변경 감지
 * - Notification: 사용자 알림 구독 및 발송
 * - SystemError: 시스템 내부 에러 처리 (Discord 에러와 구분)
 * - Admin: 관리자 명령 및 공지사항
 */
export const EVENT_DOMAIN = {
  RECRUIT: 'recruit',
  NOTIFICATION: 'notification',
  SYSTEM_ERROR: 'system_error',
  ADMIN: 'admin',
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

  // System Error actions (서버 내부 에러)
  CRITICAL: 'critical',
  WARNING: 'warning',

  // Admin actions
  BROADCAST_REQUEST: 'broadcast.request',
  BROADCAST_SENT: 'broadcast.sent',
} as const;

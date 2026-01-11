/**
 * EventBus 타입 정의
 *
 * 비즈니스 이벤트 타입과 페이로드 인터페이스를 정의합니다.
 */

import type { Job, JobDiffResult } from "@/common/types/recruitCache.d";
import type { CityEn } from "@/common/types/city.d";

/**
 * 이벤트 타입 열거형
 */
export enum EventType {
  // Recruit Domain
  RECRUIT_CRAWL_STARTED = "recruit.crawl.started",
  RECRUIT_CRAWL_COMPLETED = "recruit.crawl.completed",
  RECRUIT_CRAWL_FAILED = "recruit.crawl.failed",
  RECRUIT_NEW = "recruit.new",
  RECRUIT_REQUESTED = "recruit.requested",

  // Notification Domain
  NOTIFICATION_SUBSCRIBE = "notification.subscribe",
  NOTIFICATION_UNSUBSCRIBE = "notification.unsubscribe",
  NOTIFICATION_SEND = "notification.send",
  NOTIFICATION_SENT = "notification.sent",

  // Error Domain
  ERROR_CRITICAL = "error.critical",
  ERROR_WARNING = "error.warning",

  // Admin Domain
  ADMIN_BROADCAST_REQUEST = "admin.broadcast.request",
  ADMIN_BROADCAST_SENT = "admin.broadcast.sent",
}

/**
 * 기본 이벤트 인터페이스
 */
export interface BaseEvent {
  timestamp: number;
  source?: string;
}

/**
 * Recruit Domain 이벤트 페이로드
 */

// 크롤링 시작 이벤트
export interface RecruitCrawlStartedEvent extends BaseEvent {
  schedulerName: string;
}

// 크롤링 완료 이벤트
export interface RecruitCrawlCompletedEvent extends BaseEvent {
  schedulerName: string;
  totalCount: number;
  duration: number; // milliseconds
}

// 크롤링 실패 이벤트
export interface RecruitCrawlFailedEvent extends BaseEvent {
  schedulerName: string;
  error: Error;
  duration: number; // milliseconds
}

// 새 공고 발견 이벤트
export interface RecruitNewEvent extends BaseEvent {
  addedJobs: Job[];
  updatedJobs: Job[];
  deletedIds: string[];
}

// 사용자 공고 요청 이벤트
export interface RecruitRequestedEvent extends BaseEvent {
  userId: string;
  region?: CityEn;
  jobs: Job[];
}

/**
 * Notification Domain 이벤트 페이로드
 */

// 알림 구독 모드
export type AlertMode = "ALL" | "SELECTED";

// 알림 설정 인터페이스
export interface AlarmSubscription {
  userId: string;
  enabled: boolean;
  alertMode: AlertMode;
  regions: CityEn[];
  createdAt: number;
  updatedAt: number;
}

// 알림 구독 이벤트
export interface NotificationSubscribeEvent extends BaseEvent {
  userId: string;
  settings: AlarmSubscription;
}

// 알림 구독 해제 이벤트
export interface NotificationUnsubscribeEvent extends BaseEvent {
  userId: string;
}

// 알림 발송 시작 이벤트
export interface NotificationSendEvent extends BaseEvent {
  userId: string;
  jobs: Job[];
  settings: AlarmSubscription;
}

// 알림 발송 완료 이벤트
export interface NotificationSentEvent extends BaseEvent {
  userId: string;
  jobCount: number;
  success: boolean;
  error?: Error;
}

/**
 * Error Domain 이벤트 페이로드
 */

// 에러 심각도
export type ErrorSeverity = "critical" | "warning";

// 에러 이벤트
export interface ErrorEvent extends BaseEvent {
  severity: ErrorSeverity;
  service: string;
  error: Error;
  context?: Record<string, any>;
}

/**
 * Admin Domain 이벤트 페이로드
 */

// 전체 공지 요청 이벤트
export interface AdminBroadcastRequestEvent extends BaseEvent {
  adminId: string;
  message: string;
}

// 전체 공지 완료 이벤트
export interface AdminBroadcastSentEvent extends BaseEvent {
  adminId: string;
  message: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * 이벤트 타입 매핑
 *
 * EventType enum을 각 페이로드 타입과 매핑합니다.
 */
export interface EventPayloadMap {
  // Recruit Domain
  [EventType.RECRUIT_CRAWL_STARTED]: RecruitCrawlStartedEvent;
  [EventType.RECRUIT_CRAWL_COMPLETED]: RecruitCrawlCompletedEvent;
  [EventType.RECRUIT_CRAWL_FAILED]: RecruitCrawlFailedEvent;
  [EventType.RECRUIT_NEW]: RecruitNewEvent;
  [EventType.RECRUIT_REQUESTED]: RecruitRequestedEvent;

  // Notification Domain
  [EventType.NOTIFICATION_SUBSCRIBE]: NotificationSubscribeEvent;
  [EventType.NOTIFICATION_UNSUBSCRIBE]: NotificationUnsubscribeEvent;
  [EventType.NOTIFICATION_SEND]: NotificationSendEvent;
  [EventType.NOTIFICATION_SENT]: NotificationSentEvent;

  // Error Domain
  [EventType.ERROR_CRITICAL]: ErrorEvent;
  [EventType.ERROR_WARNING]: ErrorEvent;

  // Admin Domain
  [EventType.ADMIN_BROADCAST_REQUEST]: AdminBroadcastRequestEvent;
  [EventType.ADMIN_BROADCAST_SENT]: AdminBroadcastSentEvent;
}

/**
 * 이벤트 핸들러 함수 타입
 */
export type EventHandler<T extends EventType> = (
  payload: EventPayloadMap[T]
) => void | Promise<void>;

/**
 * 타입 안전성을 위한 헬퍼 타입
 */
export type EventName = keyof EventPayloadMap;

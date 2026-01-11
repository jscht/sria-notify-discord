/**
 * 이벤트 핸들러 등록 유틸리티
 *
 * 애플리케이션 시작 시 모든 이벤트 핸들러를 등록합니다.
 * Firebase Functions의 Cold Start 특성을 고려하여 모듈 레벨에서 1회만 실행되도록 설계되었습니다.
 */

import { eventBus } from '../EventBus';
import { LOG_COLORS } from '../constants';

/**
 * 핸들러 등록 상태 추적
 * Cold Start 시 재등록을 방지합니다.
 */
let handlersRegistered = false;

/**
 * 모든 이벤트 핸들러를 등록합니다.
 *
 * Phase별로 핸들러가 추가될 예정:
 * - Phase 1.3: RecruitCacheService 이벤트 핸들러
 * - Phase 1.7: NotificationService 이벤트 핸들러
 * - Phase 1.10: ProxyErrorHandler 이벤트 핸들러
 * - Phase 2.1: ErrorReportHandler 이벤트 핸들러
 * - Phase 2.2: AdminBroadcastHandler 이벤트 핸들러
 *
 * @example
 * ```typescript
 * // app/index.ts에서 호출
 * import { registerAllEventHandlers } from '@/eventBus/utils/registerEventHandlers';
 *
 * registerAllEventHandlers();
 * ```
 */
export function registerAllEventHandlers(): void {
  // 이미 등록된 경우 중복 등록 방지
  if (handlersRegistered) {
    console.log(
      `${LOG_COLORS.WARNING}[EventBus] Handlers already registered. Skipping...${LOG_COLORS.RESET}`
    );
    return;
  }

  console.log(
    `${LOG_COLORS.INFO}[EventBus] Registering event handlers...${LOG_COLORS.RESET}`
  );

  // Phase 1.3: RecruitCacheService 핸들러 (TODO)
  // registerRecruitHandlers();

  // Phase 1.7: NotificationService 핸들러 (TODO)
  // registerNotificationHandlers();

  // Phase 1.10: ProxyErrorHandler 핸들러 (TODO)
  // registerProxyErrorHandlers();

  // Phase 2.1: ErrorReportHandler 핸들러 (TODO)
  // registerErrorHandlers();

  // Phase 2.2: AdminBroadcastHandler 핸들러 (TODO)
  // registerAdminHandlers();

  handlersRegistered = true;

  const listenerCount = eventBus.listenerCount('recruit.new');
  console.log(
    `${LOG_COLORS.SUCCESS}[EventBus] All event handlers registered successfully${LOG_COLORS.RESET}`
  );
  console.log(
    `${LOG_COLORS.INFO}[EventBus] Active listeners: ${listenerCount}${LOG_COLORS.RESET}`
  );
}

/**
 * 핸들러 등록 상태를 반환합니다.
 *
 * @returns 핸들러가 등록되어 있으면 true, 아니면 false
 */
export function areHandlersRegistered(): boolean {
  return handlersRegistered;
}

/**
 * 핸들러 등록 상태를 초기화합니다.
 * 주로 테스트 환경에서 사용됩니다.
 */
export function resetHandlerRegistration(): void {
  handlersRegistered = false;
  eventBus.removeAllListeners();
  console.log(
    `${LOG_COLORS.INFO}[EventBus] Handler registration reset${LOG_COLORS.RESET}`
  );
}

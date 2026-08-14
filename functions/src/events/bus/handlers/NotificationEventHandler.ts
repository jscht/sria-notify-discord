import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { eventBus, EventType } from "@/events/bus";
import type { RecruitChangedEvent } from "@/events/bus";
import { notificationService } from "@/services/notificationService";

/**
 * 알림 이벤트 핸들러 등록 (Phase 1.7)
 *
 * `RECRUIT_CHANGED` → `notificationService.notifyNewRecruits` 를 연결한다.
 *
 * @remarks 핸들러 내부 try-catch로 EventBus 안정성을 확보한다(emitter로
 *   재throw 금지) — `recruitCacheService`의 발행부 try-catch 패턴과 대칭.
 *   `registerAllEventHandlers()` 자체의 startup 호출은 Phase 1.9에 위임.
 */
export function registerNotificationHandlers(): void {
  eventBus.onEvent<RecruitChangedEvent>(EventType.RECRUIT_CHANGED, async (payload) => {
    try {
      await notificationService.notifyNewRecruits(payload);
    } catch (error) {
      globalLogger.error("알림 핸들러 처리 실패", error as Error, {
        event: EventType.RECRUIT_CHANGED,
        source: "NotificationEventHandler",
      });
    }
  });
}

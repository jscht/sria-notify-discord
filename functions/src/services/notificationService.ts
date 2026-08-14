import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { SubscriptionStore } from "@/providers/firebase/store/subscription";
import { eventBus, EventType } from "@/events/bus";
import type { RecruitChangedEvent, NotificationSendEvent } from "@/events/bus";
import { filterByMode } from "@/common/utils/recruitFilter";

/**
 * 자동 알림 오케스트레이션 서비스 (Phase 1.7)
 *
 * `RECRUIT_CHANGED` 수신 → 활성 구독자 조회 → 모드/지역 필터 → 구독자별
 * `NOTIFICATION_SEND` 발행까지 담당한다.
 *
 * @remarks 설계 경계 = 이벤트 경계. 실제 DM 발송은 Phase 1.8 핸들러가
 *   `NOTIFICATION_SEND`를 소비하여 수행하므로, 본 서비스 단독으로는 DM이
 *   실제 전송되지 않는다(의도된 설계).
 */
export class NotificationService {
  private readonly subscriptionStore = new SubscriptionStore();

  /**
   * 새 공고(추가 + 변경)를 활성 구독자별로 필터링하여
   * 매칭 공고가 1건 이상인 구독자에게 `NOTIFICATION_SEND`를 발행한다.
   *
   * @param payload `RECRUIT_CHANGED` 이벤트 페이로드
   */
  async notifyNewRecruits(payload: RecruitChangedEvent): Promise<void> {
    const targetJobs = [...payload.addedJobs, ...payload.updatedJobs];
    if (targetJobs.length === 0) return;

    const subscribers = await this.subscriptionStore.getAllActiveSubscribers();

    for (const subscriber of subscribers) {
      const matchedJobs = filterByMode(targetJobs, subscriber);
      if (matchedJobs.length === 0) continue;

      // 서버리스 tick이 DM 발송 완결까지 await하도록 emitEventAndSettle 사용.
      await eventBus.emitEventAndSettle<NotificationSendEvent>(EventType.NOTIFICATION_SEND, {
        timestamp: Date.now(),
        source: "NotificationService",
        userId: subscriber.userId,
        jobs: matchedJobs,
        settings: subscriber,
      });
    }
  }
}

export const notificationService = new NotificationService();

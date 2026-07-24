import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { eventBus, EventType } from "@/events/bus";
import type { NotificationSendEvent, NotificationSentEvent } from "@/events/bus";
import {
  notificationMessageEmbed,
  notificationBannerContent,
} from "@/providers/discord/builder/embeds/notificationMessageEmbed";
import { sendNotificationDM } from "@/providers/discord/utils/dmSender";

/**
 * 알림 발송 핸들러 등록 (Phase 1.8)
 *
 * `NOTIFICATION_SEND` → 임베드 빌드 → `sendNotificationDM` → `NOTIFICATION_SENT` 발행.
 *
 * @remarks 1.7 `NotificationEventHandler` 패턴과 대칭 — 핸들러 내부 try-catch로
 *   EventBus 안정성을 확보한다(emitter로 재throw 금지). `dmSender`는 이미 graceful하게
 *   `DmSendResult`를 반환하므로 try-catch는 빌더 예외 등에 대한 2차 안전망이다.
 *   `registerAllEventHandlers()` 자체의 startup 호출은 Phase 1.9에 위임.
 */
export function registerNotificationSendHandlers(): void {
  eventBus.onEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, async (payload) => {
    try {
      if (payload.jobs.length === 0) return;

      // Phase 1.9 iterate §7: 배너 요약(content) + 상세 임베드로 분리 발송.
      const content = notificationBannerContent(payload.jobs, payload.settings);
      const embed = notificationMessageEmbed(payload.jobs, payload.settings);
      const result = await sendNotificationDM(payload.userId, {
        content,
        embeds: [embed],
      });

      // skip(DM 차단)도 success=false로 발행 — 1.9+ 소비자가 결과를 관찰한다.
      // 성공/skip/실패 구분은 dmSender가 providerLogger로 이미 기록하므로
      // SentEvent에는 추가 필드를 만들지 않는다(I-3: types.ts 계약 변경 없음).
      eventBus.emitEvent<NotificationSentEvent>(EventType.NOTIFICATION_SENT, {
        timestamp: Date.now(),
        source: "NotificationSendHandler",
        userId: payload.userId,
        jobCount: payload.jobs.length,
        success: result.ok,
        // skip은 정상 상태이므로 error 미부여. 진짜 실패(ok=false && !skipped)일 때만 부여.
        ...(!result.ok && !result.skipped
          ? { error: new Error(result.reason ?? "DM 전송 실패") }
          : {}),
      });
    } catch (error) {
      // emitter 안정성 — 재throw 금지(1.7 패턴 동일).
      globalLogger.error("알림 발송 핸들러 처리 실패", error as Error, {
        event: EventType.NOTIFICATION_SEND,
        source: "NotificationSendHandler",
      });
    }
  });
}

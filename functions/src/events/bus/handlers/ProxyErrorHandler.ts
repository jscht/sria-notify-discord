import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { crawlerLogger } from "@/common/utils/systemLogger";
import { eventBus, EventType } from "@/events/bus";
import type { ProxyUnavailableEvent } from "@/events/bus";
import { SubscriptionStore, RecruitStore } from "@/providers/firebase/store";
import { sendNotificationDM } from "@/providers/discord/utils/dmSender";
import { proxyStalenessEmbed } from "@/providers/discord/builder/embeds/proxyStalenessEmbed";
import { proxyIncidentEmbed } from "@/providers/discord/builder/embeds/proxyIncidentEmbed";
import { proxyIncident } from "@/services/proxyIncident";

const subscriptionStore = new SubscriptionStore();
const recruitStore = new RecruitStore();

/**
 * 프록시 소진 알림 핸들러 등록. (Phase 1.10)
 *
 * `PROXY_UNAVAILABLE`(스케줄 갱신 실패에서만 발행) →
 * ① 구독자 전체에 신선도(staleness) 안내 — 갱신 안 되는 한 매 틱 지속.
 * ② 개발자 알림 — incident 시작 시 1회 DM. 발생/복구는 incident id 로그로 짝지어 구분.
 *
 * @remarks 이벤트 반응형 핸들러이므로 `events/bus/handlers/`에 위치(NotificationSendHandler와 동종).
 *   핸들러 내부 try-catch로 emitter 안정성 확보(재throw 금지).
 */
export function registerProxyErrorHandlers(): void {
  eventBus.onEvent<ProxyUnavailableEvent>(EventType.PROXY_UNAVAILABLE, async (payload) => {
    try {
      const lastRefreshedAt = await recruitStore.getLastRefreshedAt();

      // 1) 사용자 staleness 안내 — 전체 활성 구독자(diff 없음 → 지역필터 근거 없음), 내부 원인 비노출.
      const subs = await subscriptionStore.getAllActiveSubscribers();
      const embed = proxyStalenessEmbed(lastRefreshedAt);
      for (const subscriber of subs) {
        await sendNotificationDM(subscriber.userId, { embeds: [embed] });
      }

      // 2) 개발자 알림 — incident 시작 시 1회 DM. 매 틱 발생은 로그(durable)만.
      const opened = await proxyIncident.openIfAbsent();
      if (opened) {
        crawlerLogger.error("proxy incident OPENED", undefined, {
          incidentId: opened.id,
          startedAt: opened.startedAt,
          reason: payload.reason,
        });
        const adminId = process.env.ADMIN_USER_ID;
        if (adminId) {
          await sendNotificationDM(adminId, {
            embeds: [
              proxyIncidentEmbed({
                incidentId: opened.id,
                startedAt: opened.startedAt,
                reason: payload.reason,
                attempts: payload.attempts,
                lastProxyIp: payload.lastProxyIp,
              }),
            ],
          });
        }
      } else {
        crawlerLogger.warn("proxy incident ONGOING", { reason: payload.reason });
      }
    } catch (error) {
      globalLogger.error("proxyError 알림 처리 실패", error as Error, {
        event: EventType.PROXY_UNAVAILABLE,
      });
    }
  });
}

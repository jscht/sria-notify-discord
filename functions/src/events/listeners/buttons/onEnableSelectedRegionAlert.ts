import type { ButtonInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { AlertMode } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "@/events/listeners/buttons/renderSubscribeManage";
import { initialSourceFilter } from "@/providers/recruit/sourceToggle";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * ALERT_MODE:SELECTED 버튼 핸들러.
 *
 * 선택 지역 알림(SELECTED) 모드를 확정하고 지역 편집 UI로 진입한다.
 * - 신규 사용자(모드 null): `subscribe`로 활성화. 사이트는 일반 공고만 켠다
 * - 기존 사용자가 다른 모드: `updateMode`로 SELECTED 전환
 * 확정 후 현재 지역 목록과 지역 편집 버튼을 노출한다.
 */
export async function onEnableSelectedRegionAlert(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;

  await withDisabledComponents(interaction, async () => {
    const current = await alarmSubscriptionService.getUserAlertMode(userId);
    let sub: AlarmSubscription | null;
    if (current === null) {
      sub = await alarmSubscriptionService.subscribe(userId, {
        enabled: true,
        regions: { mode: AlertMode.SELECTED, values: [] },
        sources: initialSourceFilter(),
      });
    } else if (current !== AlertMode.SELECTED) {
      sub = await alarmSubscriptionService.updateMode(userId, AlertMode.SELECTED);
    } else {
      sub = await alarmSubscriptionService.getSubscription(userId);
    }

    // 방어: 구독 정보가 없으면 #1과 동일하게 뒤로가기만 노출하고 종료한다.
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await renderSubscribeManage(interaction, sub);
  });
}

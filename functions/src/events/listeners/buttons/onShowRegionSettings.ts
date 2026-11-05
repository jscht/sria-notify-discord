import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "./renderSubscribeManage";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * SUBSCRIBE_OPTION:REGION 버튼 핸들러.
 *
 * 설정 관리 화면에서 지역 화면으로 내려간다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onShowRegionSettings(interaction: ButtonInteraction): Promise<void> {
  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await renderSubscribeManage(interaction, sub);
  });
}

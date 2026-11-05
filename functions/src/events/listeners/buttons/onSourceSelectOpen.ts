import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderSourceSettings } from "./renderSourceSettings";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * SOURCE_SELECT:OPEN 버튼 핸들러.
 *
 * 설정 관리 화면에서 사이트 설정 화면을 연다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onSourceSelectOpen(interaction: ButtonInteraction): Promise<void> {
  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await renderSourceSettings(interaction, sub);
  });
}

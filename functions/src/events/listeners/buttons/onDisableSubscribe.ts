import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";

/**
 * SUBSCRIBE_OPTION:DISABLE 버튼 핸들러.
 *
 * 알림을 비활성화(unsubscribe)한 뒤 갱신된 진입 화면으로 복귀한다.
 */
export async function onDisableSubscribe(interaction: ButtonInteraction): Promise<void> {
  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.unsubscribe(interaction.user.id);
    const { content, components } = buildSubscribeEntryView(sub);

    await interaction.editReply({ content, components, embeds: [] });
  });
}

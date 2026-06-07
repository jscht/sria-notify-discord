import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";
import { disableMessageComponents } from "@/providers/discord/builder/disableMessageComponents";

/**
 * SUBSCRIBE_OPTION:BACK 버튼 핸들러.
 *
 * 관리/모드변경 화면에서 진입 화면으로 복귀한다.
 */
export async function onSubscribeBack(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
  const { content, components } = buildSubscribeEntryView(sub);

  await interaction.editReply({ content, components, embeds: [] });
}

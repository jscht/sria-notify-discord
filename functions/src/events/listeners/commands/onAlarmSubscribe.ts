import { CommandInteraction, MessageFlags } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";

/**
 * /alarm-subscribe 진입점.
 *
 * 현재 구독 상태를 조회해 상태 요약 + 옵션 버튼(켜기·끄기/설정 관리)을 노출한다.
 */
export async function onAlarmSubscribe(interaction: CommandInteraction): Promise<void> {
  const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
  const { content, components } = buildSubscribeEntryView(sub);

  await interaction.reply({
    content,
    components,
    flags: MessageFlags.Ephemeral,
  });
}

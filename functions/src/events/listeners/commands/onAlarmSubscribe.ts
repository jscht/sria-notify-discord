import { CommandInteraction, MessageFlags } from "discord.js";
import { showSubscribeOptionButtons } from "@/providers/discord/builder/buttons/showSubscribeOptionButtons";

/**
 * /alarm-subscribe 진입점.
 *
 * 사용자에게 알림 옵션(켜기/관리) 버튼을 노출한다.
 * 모드 변경/저장 분기는 Phase 1.5 의 SubscriptionService 연동에서 완성한다.
 */
export async function onAlarmSubscribe(interaction: CommandInteraction): Promise<void> {
  const buttons = showSubscribeOptionButtons();

  await interaction.reply({
    content: "🔔 알림을 시작하거나 설정을 변경할 수 있어요.",
    components: [buttons],
    flags: MessageFlags.Ephemeral,
  });
}

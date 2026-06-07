import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { disableMessageComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "./renderSubscribeManage";

/**
 * REGION_MODE_CHANGE:CANCEL 버튼 핸들러.
 *
 * 모드 변경을 취소하고 관리 화면으로 복귀한다.
 * 구독이 없으면 안내 메시지를 노출한다.
 */
export async function onChangeCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
  if (!sub) {
    await interaction.editReply({
      content: "아직 알림 설정이 없어요.",
      embeds: [],
      components: [],
    });
    return;
  }

  await renderSubscribeManage(interaction, sub);
}

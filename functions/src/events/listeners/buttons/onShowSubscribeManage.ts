import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import { disableMessageComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "./renderSubscribeManage";

/**
 * SUBSCRIBE_OPTION:MANAGE 버튼 핸들러.
 *
 * 현재 구독 설정을 조회해 관리 화면(Embed + 관리 버튼)으로 보여준다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onShowSubscribeManage(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
  if (!sub) {
    await interaction.editReply({
      content: "아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.",
      embeds: [],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(subscribeOptionActionId.BACK)
            .setLabel("⬅️ 뒤로")
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return;
  }

  await renderSubscribeManage(interaction, sub);
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { StringSelectMenuInteraction } from "discord.js";
import type { CityEn } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "@/events/listeners/buttons/renderSubscribeManage";

/**
 * 지역 제거 핸들러.
 *
 * Firestore 접근이 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 */
export async function onRegionRemoveSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  const userId = interaction.user.id;
  const cityEn = interaction.values[0] as CityEn;

  try {
    const sub = await alarmSubscriptionService.getSubscription(userId);

    // 방어: 구독 정보가 없으면 #1과 동일하게 뒤로가기만 노출하고 종료한다.
    if (!sub) {
      await interaction.editReply({
        content: "아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.",
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

    const updated = await alarmSubscriptionService.updateRegions(
      userId,
      sub.regions.filter((r) => r !== cityEn)
    );
    await renderSubscribeManage(interaction, updated);
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

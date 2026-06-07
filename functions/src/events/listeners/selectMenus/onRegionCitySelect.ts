import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { StringSelectMenuInteraction } from "discord.js";
import type { CityEn } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { MAX_REGION_COUNT } from "@/features/alarmSubscribe/commands/slashCommand";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import { disableMessageComponents } from "@/providers/discord/builder/disableMessageComponents";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import { renderSubscribeManage } from "@/events/listeners/buttons/renderSubscribeManage";

/**
 * 2단계 — 시 선택(추가) 핸들러.
 *
 * Firestore 접근이 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 * 중복/상한(MAX_REGION_COUNT) 검사는 철거된 모달 핸들러에서 계승했다.
 */
export async function onRegionCitySelect(interaction: StringSelectMenuInteraction): Promise<void> {
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  const userId = interaction.user.id;
  const cityEn = interaction.values[0] as CityEn;

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

  const current = sub.regions;

  if (current.includes(cityEn)) {
    await interaction.editReply({
      content: "이미 추가된 지역이에요.",
      components: subscribeManageButtons(sub),
    });
    return;
  }
  if (current.length >= MAX_REGION_COUNT) {
    await interaction.editReply({
      content: `최대 ${MAX_REGION_COUNT}개까지 선택할 수 있어요.`,
      components: subscribeManageButtons(sub),
    });
    return;
  }

  const updated = await alarmSubscriptionService.updateRegions(userId, [...current, cityEn]);
  await renderSubscribeManage(interaction, updated);
}

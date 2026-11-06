import type { ButtonInteraction, CommandInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { regionMenuBackButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import {
  regionGroupMenuContent,
  regionGroupSelectMenu,
} from "@/providers/discord/builder/selectMenus/regionSelectMenus";
import { rerenderIfAllRegions } from "./renderSubscribeManage";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

export type SubscribeAddPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region?: string;
};

/**
 * 지역 추가 진입 — 권역 선택 메뉴를 노출한다(권역→시 2단계의 1단계).
 * 켜진 공고의 권역만 보여 주려고 구독 정보를 읽는다. 읽는 동안 버튼을 잠근다.
 */
export async function subscribeAdd(payload: SubscribeAddPayload): Promise<void> {
  const { interaction } = payload;
  if (!interaction.isButton()) {
    return;
  }

  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }
    if (await rerenderIfAllRegions(interaction, sub)) return;

    await interaction.editReply({
      content: regionGroupMenuContent(sub.sources),
      components: [regionGroupSelectMenu(sub.sources), regionMenuBackButtons()],
    });
  });
}

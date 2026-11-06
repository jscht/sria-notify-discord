import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import { regionMenuBackButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { regionRemoveSelectMenu } from "@/providers/discord/builder/selectMenus/regionSelectMenus";
import { activeRegions } from "@/providers/recruit/sourceToggle";
import { rerenderIfAllRegions } from "./renderSubscribeManage";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

export type SubscribeRemovePayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region?: string;
};

/**
 * 지역 제거 진입 — 현재 구독 지역을 제거 메뉴로 노출한다.
 * Firestore 조회가 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 * 제거할 지역이 없으면 안내 후 편집 버튼만 다시 노출한다.
 */
export async function subscribeRemove(payload: SubscribeRemovePayload): Promise<void> {
  const { interaction } = payload;
  if (!interaction.isButton()) {
    return;
  }

  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);

    // 방어: 구독 정보가 없으면 #1과 동일하게 뒤로가기만 노출하고 종료한다.
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }
    if (await rerenderIfAllRegions(interaction, sub)) return;

    const regions = activeRegions(sub);

    if (regions.length === 0) {
      await interaction.editReply({
        content: "제거할 지역이 없어요.",
        components: subscribeManageButtons(sub),
      });
      return;
    }

    await interaction.editReply({
      content: "제거할 지역을 선택하세요",
      components: [regionRemoveSelectMenu(regions), regionMenuBackButtons()],
    });
  }, { loading: false });
}

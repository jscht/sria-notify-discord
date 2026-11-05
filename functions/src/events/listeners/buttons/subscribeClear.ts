import type { ButtonInteraction, CommandInteraction } from "discord.js";
import { selectedValues } from "@/common/utils/alarmFilter";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { activeRegions } from "@/providers/recruit/sourceToggle";
import {
  renderSubscribeManage,
  rerenderIfAllRegions,
} from "@/events/listeners/buttons/renderSubscribeManage";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

export type SubscribeClearPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
};

/**
 * 지역 초기화 — 화면에 보이는 지역을 비우고 관리 화면을 재렌더한다.
 *
 * 꺼진 공고의 지역은 남겨 둔다. 다시 켜면 그대로 쓰기 위해서다.
 */
export async function subscribeClear(payload: SubscribeClearPayload): Promise<void> {
  const { interaction } = payload;
  if (!interaction.isButton()) {
    return;
  }

  await withDisabledComponents(interaction, async () => {
    const userId = interaction.user.id;
    const sub = await alarmSubscriptionService.getSubscription(userId);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }
    if (await rerenderIfAllRegions(interaction, sub)) return;

    const shown = activeRegions(sub);
    const updated = await alarmSubscriptionService.updateRegions(
      userId,
      selectedValues(sub.regions).filter((region) => !shown.includes(region))
    );
    await renderSubscribeManage(interaction, updated);
  });
}

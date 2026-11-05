import type { StringSelectMenuInteraction } from "discord.js";
import type { CityEn } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import {
  renderSubscribeManage,
  rerenderIfAllRegions,
} from "@/events/listeners/buttons/renderSubscribeManage";
import { renderNoSubscription } from "@/events/listeners/buttons/renderSubscribeSettingsHub";

/**
 * 지역 제거 핸들러.
 *
 * Firestore 접근이 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 */
export async function onRegionRemoveSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const cityEn = interaction.values[0] as CityEn;

  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(userId);

    // 방어: 구독 정보가 없으면 #1과 동일하게 뒤로가기만 노출하고 종료한다.
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }
    if (await rerenderIfAllRegions(interaction, sub)) return;

    const updated = await alarmSubscriptionService.updateRegions(
      userId,
      selectedValues(sub.regions).filter((r) => r !== cityEn)
    );
    await renderSubscribeManage(interaction, updated);
  });
}

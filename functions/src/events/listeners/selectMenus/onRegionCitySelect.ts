import type { StringSelectMenuInteraction } from "discord.js";
import type { CityEn } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { MAX_REGION_COUNT } from "@/features/alarmSubscribe/commands/slashCommand";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import {
  renderSubscribeManage,
  rerenderIfAllRegions,
} from "@/events/listeners/buttons/renderSubscribeManage";
import { renderNoSubscription } from "@/events/listeners/buttons/renderSubscribeSettingsHub";
import { findRegionToggle, isToggleFull } from "@/providers/recruit/sourceToggle";

/**
 * 2단계 — 시 선택(추가) 핸들러.
 *
 * Firestore 접근이 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 * 중복/상한(MAX_REGION_COUNT) 검사는 철거된 모달 핸들러에서 계승했다.
 */
export async function onRegionCitySelect(interaction: StringSelectMenuInteraction): Promise<void> {
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

    const current = selectedValues(sub.regions);

    if (current.includes(cityEn)) {
      await interaction.editReply({
        content: "이미 추가된 지역이에요.",
        components: subscribeManageButtons(sub),
      });
      return;
    }
    const toggle = findRegionToggle(cityEn);
    if (toggle && isToggleFull(toggle, current, MAX_REGION_COUNT)) {
      await interaction.editReply({
        content: `${toggle.regionLabel}은 최대 ${MAX_REGION_COUNT}개까지 선택할 수 있어요.`,
        components: subscribeManageButtons(sub),
      });
      return;
    }

    const updated = await alarmSubscriptionService.updateRegions(userId, [...current, cityEn]);
    await renderSubscribeManage(interaction, updated);
  });
}

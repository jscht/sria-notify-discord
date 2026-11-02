import type { StringSelectMenuInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmFilter, RecruitSource } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { SOURCE_SELECT_MENU_ID } from "@/providers/discord/builder/selectMenus/sourceSelectMenu";
import { getUserFacingSources } from "@/providers/recruit";
import { finishFirstSourceStep } from "@/events/listeners/buttons/firstSourceStep";
import { renderSubscribeSettingsHub } from "@/events/listeners/buttons/renderSubscribeSettingsHub";

const SAVED_NOTICE = "✅ 알림 받을 사이트를 저장했어요.";

/**
 * 사이트 선택 메뉴 제출 핸들러 (`source-select`, `source-select-first` 공용).
 *
 * 메뉴를 연 뒤 노출 설정이 바뀌어도 숨긴 사이트가 저장되지 않도록 제출 값을 다시 거른다.
 * 노출 사이트를 전부 고르면 ALL로 저장한다. 메뉴에 "모든 사이트" 칸이 따로 없어서,
 * 일부만 고른 사용자가 ALL로 돌아갈 방법이 이것뿐이다.
 * 저장 뒤에는 메뉴를 연 위치에 맞는 화면으로 돌아간다.
 */
export async function onSourceSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  try {
    const visible = getUserFacingSources();
    const picked = visible.filter((source) => interaction.values.includes(source));

    if (picked.length === 0) {
      await interaction.editReply({
        content: "알림 받을 사이트를 1개 이상 고르세요.",
        components: restoreMessageComponents(original),
      });
      return;
    }

    const filter: AlarmFilter<RecruitSource> = picked.length === visible.length ?
      { mode: AlertMode.ALL } :
      { mode: AlertMode.SELECTED, values: picked };
    const updated = await alarmSubscriptionService.updateSources(interaction.user.id, filter);

    if (interaction.customId === SOURCE_SELECT_MENU_ID.FIRST) {
      await finishFirstSourceStep(interaction, updated, SAVED_NOTICE);
    } else {
      await renderSubscribeSettingsHub(interaction, updated, SAVED_NOTICE);
    }
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

import type { StringSelectMenuInteraction } from "discord.js";
import type { CityGroupKey } from "@/common/constants/city";
import { regionCityBackButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import {
  regionCityMenuContent,
  regionCitySelectMenu,
} from "@/providers/discord/builder/selectMenus/regionSelectMenus";

/**
 * 1단계 — 권역 선택 핸들러.
 *
 * 고른 메뉴를 먼저 잠근 뒤 시 선택 메뉴로 바꾼다. 응답 한 번으로 바로 바꾸면 Discord 앱에
 * 로딩 표시가 남고 시 선택 메뉴를 골라도 요청이 오지 않는 일이 있었다(런타임 검증 U-1).
 *
 * @param interaction 권역 선택 메뉴 인터랙션
 */
export async function onRegionGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const groupKey = interaction.values[0] as CityGroupKey;

  await withDisabledComponents(interaction, async () => {
    await interaction.editReply({
      content: regionCityMenuContent(groupKey),
      components: [regionCitySelectMenu(groupKey), regionCityBackButtons()],
    });
  }, { loading: false });
}

import type { StringSelectMenuInteraction } from "discord.js";
import type { CityGroupKey } from "@/common/constants/city";
import { regionCitySelectMenu } from "@/providers/discord/builder/selectMenus/regionSelectMenus";

/**
 * 1단계 — 권역 선택 핸들러.
 *
 * 서비스/Firestore 접근이 없으므로 defer 없이 `update`로 같은 메시지를
 * 해당 권역의 시 선택 메뉴로 즉시 교체한다(컴포넌트 교체 2단계 패턴).
 */
export async function onRegionGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const groupKey = interaction.values[0] as CityGroupKey;
  await interaction.update({
    content: "시를 선택하세요",
    components: [regionCitySelectMenu(groupKey)],
  });
}

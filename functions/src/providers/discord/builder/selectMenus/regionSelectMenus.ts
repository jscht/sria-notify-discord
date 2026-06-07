import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { CITIES, CITY_GROUPS, type CityGroupKey } from "@/common/constants/city";
import type { CityEn } from "@/common/types";

/**
 * 1단계 — 권역 선택 메뉴.
 *
 * customId `region-group-select`. 선택값(`values[0]`)은 `CityGroupKey`.
 * 단일 StringSelectMenu는 25개 옵션 한계라 75개 시를 직접 노출할 수 없으므로
 * 권역(10) → 시(≤19) 2단계로 분할한다.
 */
export function regionGroupSelectMenu(): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("region-group-select")
    .setPlaceholder("권역을 선택하세요")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      (Object.entries(CITY_GROUPS) as [CityGroupKey, (typeof CITY_GROUPS)[CityGroupKey]][]).map(
        ([key, group]) => ({ label: group.label, value: key })
      )
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * 2단계 — 선택된 권역의 시 선택 메뉴.
 *
 * customId `region-city-select`. 선택값(`values[0]`)은 곧 `CityEn`이라
 * 권역 컨텍스트를 customId에 실을 필요가 없다(1단계 핸들러가 해당 권역으로 빌드).
 *
 * @param groupKey 1단계에서 선택된 권역 키
 */
export function regionCitySelectMenu(
  groupKey: CityGroupKey
): ActionRowBuilder<StringSelectMenuBuilder> {
  const cities = CITY_GROUPS[groupKey].cities;
  const menu = new StringSelectMenuBuilder()
    .setCustomId("region-city-select")
    .setPlaceholder("시를 선택하세요")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      (Object.entries(cities) as [CityEn, string][]).map(([en, ko]) => ({
        label: ko,
        value: en,
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/**
 * 제거할 지역 선택 메뉴.
 *
 * customId `region-remove-select`. 현재 구독 중인 지역(`CityEn[]`)만 옵션으로 노출한다.
 *
 * @param regions 현재 선택된 지역 목록
 */
export function regionRemoveSelectMenu(
  regions: CityEn[]
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("region-remove-select")
    .setPlaceholder("제거할 지역을 선택하세요")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(regions.map((r) => ({ label: CITIES[r], value: r })));

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

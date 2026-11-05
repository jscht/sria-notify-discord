import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { CITIES, CITY_GROUPS, type CityGroupKey } from "@/common/constants/city";
import type { AlarmFilter, CityEn, RecruitSource } from "@/common/types";
import { sourceDescriptions } from "@/providers/discord/builder/subscriptionSummary";
import { activeToggles, visibleRegionGroups } from "@/providers/recruit/sourceToggle";

/**
 * 권역 메뉴와 함께 보여 줄 안내 문구.
 *
 * 공고가 둘 이상 켜져 있을 때만 공고 설명을 넣는다. 하나면 고를 지역이 그 공고 것뿐이다.
 *
 * @param sources 구독자 사이트 필터
 * @returns 메뉴 위에 보여 줄 문구
 */
export function regionGroupMenuContent(sources: AlarmFilter<RecruitSource>): string {
  const toggles = activeToggles(sources);
  const step = "1/2단계 — 권역을 선택하세요";
  if (toggles.length < 2) return step;

  return [step, ...sourceDescriptions(toggles)].join("\n");
}

/**
 * 시 선택 메뉴의 안내 문구. 권역마다 하위 항목 이름이 달라 권역 설정의 `itemPrompt`를 쓴다.
 *
 * @param groupKey 1단계에서 선택된 권역 키
 * @returns 메뉴 위에 보여 줄 문구
 */
export function regionCityMenuContent(groupKey: CityGroupKey): string {
  return `2/2단계 — ${CITY_GROUPS[groupKey].itemPrompt}`;
}

/** 권역 옵션 설명. 하위 항목이 있다는 것을 알리려고 앞 두 곳과 나머지 개수를 보여 준다. */
function groupDescription(cities: Record<string, string>): string {
  const names = Object.values(cities);
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} 외 ${names.length - 2}곳` : shown;
}

/**
 * 1단계 — 권역 선택 메뉴.
 *
 * customId `region-group-select`. 선택값(`values[0]`)은 `CityGroupKey`.
 * 단일 StringSelectMenu는 25개 옵션 한계라 77개 시를 직접 노출할 수 없으므로
 * 권역(11) → 시(≤19) 2단계로 분할한다. 켜진 공고의 권역만 보여 준다.
 *
 * @param sources 구독자 사이트 필터
 */
export function regionGroupSelectMenu(
  sources: AlarmFilter<RecruitSource>
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("region-group-select")
    .setPlaceholder("권역을 선택하세요")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      visibleRegionGroups(sources).map((key) => ({
        label: `${CITY_GROUPS[key].label} ▸`,
        value: key,
        description: groupDescription(CITY_GROUPS[key].cities),
      }))
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
    .setPlaceholder(CITY_GROUPS[groupKey].itemPrompt)
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

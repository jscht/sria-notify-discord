import { CITIES, CITY_GROUPS, type CityGroupKey } from "@/common/constants/city";
import { AlertMode } from "@/common/types";
import type { AlarmFilter, AlarmSubscription, CityEn, RecruitSource } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { getAllProviders, getSourceConfig, getUserFacingSources } from "./index";

/** 켜기/끄기 버튼 하나의 키. 고유 지역을 가진 사이트를 추가하면 여기에도 넣는다. */
export type SourceToggleKey = "korea" | "elias";

/** 구독자가 켜고 끄는 공고 묶음. 저장은 `sources` 필터 하나로 한다. */
export interface SourceToggle {
  key: SourceToggleKey;
  /** 버튼과 요약에 보이는 이름 */
  label: string;
  /** 지역 개수 제한 문구에 쓰는 이름 */
  regionLabel: string;
  /** 사이트 설정 화면과 권역 메뉴의 공고 설명 */
  description: string;
  /** 이 묶음에 든 사이트 */
  sources: RecruitSource[];
  /** 이 묶음이 켜져 있을 때 지역 메뉴에 보이는 권역 */
  regionGroups: CityGroupKey[];
}

/** 공고 묶음 하나와 그 묶음에서 고른 지역. */
export interface ToggleRegions {
  toggle: SourceToggle;
  regions: CityEn[];
}

/**
 * 공고 묶음을 돌려준다.
 *
 * 고유 지역이 없는 사이트는 모두 "일반 공고"로 묶어 사이트가 늘어도 버튼이 늘지 않는다.
 * 고유 지역이 있는 사이트는 지역이 달라 따로 켜고 끈다.
 *
 * @returns 노출 사이트가 있는 묶음만. 일반 공고가 먼저 온다
 */
export function getSourceToggles(): SourceToggle[] {
  const ownGroups = new Set(
    getAllProviders().flatMap(({ source }) => getSourceConfig(source).ownRegionGroup ?? [])
  );
  const allGroups = Object.keys(CITY_GROUPS) as CityGroupKey[];
  const visible = getUserFacingSources();

  const korea = visible.filter((source) => !getSourceConfig(source).ownRegionGroup);
  const toggles: SourceToggle[] = korea.length > 0 ? [{
    key: "korea",
    label: "일반 공고",
    regionLabel: "대한민국 지역",
    description: "대한민국 지역의 공고",
    sources: korea,
    regionGroups: allGroups.filter((group) => !ownGroups.has(group)),
  }] : [];

  for (const source of visible) {
    const { ownRegionGroup, displayName } = getSourceConfig(source);
    if (!ownRegionGroup) continue;
    toggles.push({
      key: source as SourceToggleKey,
      label: `${displayName} 공고`,
      regionLabel: `${displayName} 지역`,
      description: `${displayName} 지역의 공고`,
      sources: [source],
      regionGroups: [ownRegionGroup],
    });
  }
  return toggles;
}

/**
 * 첫 구독 때 저장할 사이트 필터. 일반 공고만 켠다.
 *
 * 고유 지역 공고(elias 등)는 사용자가 사이트 설정에서 직접 켠다.
 * sria를 직접 적지 않고 묶음에서 계산하므로 한국 사이트가 늘어도 일반 공고 전체가 켜진다.
 *
 * @returns 일반 공고 묶음의 사이트만 고른 SELECTED. 일반 공고 묶음이 없으면 ALL
 */
export function initialSourceFilter(): AlarmFilter<RecruitSource> {
  const korea = getSourceToggles().find((toggle) => toggle.key === "korea");
  return korea ? { mode: AlertMode.SELECTED, values: korea.sources } : { mode: AlertMode.ALL };
}

/**
 * 묶음이 켜져 있는지 확인한다.
 *
 * 묶음 안의 사이트가 하나라도 저장돼 있으면 켜진 것으로 본다. 그래서 `SELECTED [sria]`를
 * 저장한 구독자도 나중에 추가되는 한국 사이트를 함께 받는다.
 *
 * @param toggle 공고 묶음
 * @param filter 구독자 사이트 필터
 * @returns 켜져 있으면 true
 */
export function isToggleOn(toggle: SourceToggle, filter: AlarmFilter<RecruitSource>): boolean {
  if (filter.mode === AlertMode.ALL) return true;
  return toggle.sources.some((source) => filter.values.includes(source));
}

/**
 * 저장된 사이트 필터를 묶음 단위로 넓힌다. 알림 판정에서 사이트 필터 앞에 쓴다.
 *
 * @param filter 구독자 사이트 필터
 * @returns ALL이면 그대로, SELECTED면 켜진 묶음의 사이트 전체
 */
export function expandSourceFilter(
  filter: AlarmFilter<RecruitSource>
): AlarmFilter<RecruitSource> {
  if (filter.mode === AlertMode.ALL) return filter;
  return {
    mode: AlertMode.SELECTED,
    values: getSourceToggles()
      .filter((toggle) => isToggleOn(toggle, filter))
      .flatMap((toggle) => toggle.sources),
  };
}

/**
 * 묶음 하나를 켜거나 끈 뒤의 사이트 필터를 계산한다.
 *
 * @param filter 구독자 사이트 필터
 * @param key 바꿀 묶음
 * @returns 바뀐 필터. 켜진 묶음이 없어지면 알림을 받을 수 없으므로 null
 */
export function toggleSourceFilter(
  filter: AlarmFilter<RecruitSource>,
  key: SourceToggleKey
): AlarmFilter<RecruitSource> | null {
  const toggles = getSourceToggles();
  const on = toggles.filter((toggle) =>
    toggle.key === key ? !isToggleOn(toggle, filter) : isToggleOn(toggle, filter)
  );
  if (on.length === 0) return null;
  if (on.length === toggles.length) return { mode: AlertMode.ALL };
  return { mode: AlertMode.SELECTED, values: on.flatMap((toggle) => toggle.sources) };
}

/**
 * 화면과 지역 편집에서 쓸 묶음을 돌려준다.
 *
 * @param filter 구독자 사이트 필터
 * @returns 켜진 묶음. 켜진 묶음이 없는 문서는 지역을 편집할 수 있게 묶음 전체
 */
export function activeToggles(filter: AlarmFilter<RecruitSource>): SourceToggle[] {
  const toggles = getSourceToggles();
  const on = toggles.filter((toggle) => isToggleOn(toggle, filter));
  return on.length > 0 ? on : toggles;
}

/**
 * 지역 메뉴에 보일 권역을 돌려준다.
 *
 * @param filter 구독자 사이트 필터
 * @returns 켜진 묶음의 권역. 켜진 묶음이 없는 문서는 메뉴가 비지 않게 권역 전체
 */
export function visibleRegionGroups(filter: AlarmFilter<RecruitSource>): CityGroupKey[] {
  return activeToggles(filter).flatMap((toggle) => toggle.regionGroups);
}

/**
 * 지역이 묶음의 권역에 드는지 확인한다.
 *
 * @param region 지역
 * @param toggle 공고 묶음
 * @returns 묶음의 권역에 들면 true
 */
export function isRegionInToggle(region: CityEn, toggle: SourceToggle): boolean {
  return toggle.regionGroups.some((group) => region in CITY_GROUPS[group].cities);
}

/**
 * 고른 지역을 켜진 공고별로 나눠 한글 가나다순으로 돌려준다.
 *
 * 꺼진 공고의 지역은 저장값에 남겨 두고 화면에서만 뺀다. 다시 켜면 그대로 쓰기 위해서다.
 *
 * @param sub 구독자의 지역·사이트 필터
 * @returns 켜진 묶음마다 하나. 고른 지역이 없는 묶음은 `regions`가 빈 배열이다
 */
export function activeRegionsByToggle(
  sub: Pick<AlarmSubscription, "regions" | "sources">
): ToggleRegions[] {
  const saved = selectedValues(sub.regions);

  return activeToggles(sub.sources).map((toggle) => ({
    toggle,
    regions: saved
      .filter((region) => isRegionInToggle(region, toggle))
      .sort((a, b) => CITIES[a].localeCompare(CITIES[b], "ko")),
  }));
}

/**
 * 화면에 보여 줄 지역을 한 줄로 이어 돌려준다.
 *
 * @param sub 구독자의 지역·사이트 필터
 * @returns 켜진 공고의 지역. 순서는 `activeRegionsByToggle`을 따른다
 */
export function activeRegions(sub: Pick<AlarmSubscription, "regions" | "sources">): CityEn[] {
  return activeRegionsByToggle(sub).flatMap(({ regions }) => regions);
}

/**
 * 지역이 속한 묶음을 찾는다.
 *
 * @param region 지역
 * @returns 지역이 속한 묶음. 노출 사이트의 지역이 아니면 undefined
 */
export function findRegionToggle(region: CityEn): SourceToggle | undefined {
  return getSourceToggles().find((toggle) => isRegionInToggle(region, toggle));
}

/**
 * 묶음에 고를 수 있는 지역을 다 채웠는지 확인한다. 지역 개수 제한은 묶음마다 따로 센다.
 *
 * @param toggle 공고 묶음
 * @param regions 저장된 지역 전체
 * @param max 묶음마다 고를 수 있는 지역 수
 * @returns 다 채웠으면 true
 */
export function isToggleFull(toggle: SourceToggle, regions: CityEn[], max: number): boolean {
  return regions.filter((region) => isRegionInToggle(region, toggle)).length >= max;
}

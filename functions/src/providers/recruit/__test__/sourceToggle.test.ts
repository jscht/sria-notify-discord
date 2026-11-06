import "dotenv/config";
/**
 * 공고 묶음 켜기/끄기 테스트 (design §2.9.5)
 */

import type { AlarmFilter, AlarmSubscription, CityEn, Job, RecruitSource } from "@/common/types";
import { AlertMode } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { filterByRegion, filterBySource } from "@/common/utils/recruitFilter";
import { alertRegionEditActionId } from "@/features/alarmSubscribe/constants";
import { selectedRegionContent } from "@/providers/discord/builder/buttons/formatRegionList";
import { sourceToggleButtons } from "@/providers/discord/builder/buttons/sourceToggleButtons";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import {
  regionGroupMenuContent,
  regionGroupSelectMenu,
} from "@/providers/discord/builder/selectMenus/regionSelectMenus";
import {
  regionSummary,
  sourceDescriptions,
  sourceSummary,
} from "@/providers/discord/builder/subscriptionSummary";
import { expectEqual, reportResult, runCases } from "@/test/harness";
import { makeEliasJob, makeSriaJob } from "@/test/mocks/multiSource";
import {
  activeRegions,
  activeRegionsByToggle,
  expandSourceFilter,
  findRegionToggle,
  getSourceToggles,
  initialSourceFilter,
  isToggleFull,
  toggleSourceFilter,
  visibleRegionGroups,
} from "../sourceToggle";

const ALL: AlarmFilter<RecruitSource> = { mode: AlertMode.ALL };
const KOREA_ONLY: AlarmFilter<RecruitSource> = { mode: AlertMode.SELECTED, values: ["sria"] };
const ELIAS_ONLY: AlarmFilter<RecruitSource> = { mode: AlertMode.SELECTED, values: ["elias"] };

const SRIA_SEOUL = makeSriaJob(1, { title: "[서울] sria 공고" });
const ELIAS_FAIRY = makeEliasJob(1, { title: "[요정 왕국] elias 공고" });
const JOBS: Job[] = [SRIA_SEOUL, ELIAS_FAIRY];

function subscription(
  sources: AlarmFilter<RecruitSource>,
  regions: CityEn[],
): AlarmSubscription {
  return {
    userId: "u1",
    enabled: true,
    regions: { mode: AlertMode.SELECTED, values: regions },
    sources,
    createdAt: 0,
    updatedAt: 0,
  };
}

function matched(sources: AlarmFilter<RecruitSource>, regions: AlarmFilter<CityEn>): string[] {
  return filterByRegion(filterBySource(JOBS, expandSourceFilter(sources)), regions)
    .map((job) => job.id);
}

function menuValues(sources: AlarmFilter<RecruitSource>): string[] {
  const [menu] = regionGroupSelectMenu(sources).toJSON().components as unknown as
    { options: { value: string }[] }[];
  return menu.options.map((option) => option.value);
}

function buttonStates(sources: AlarmFilter<RecruitSource>): [string, boolean][] {
  const buttons = sourceToggleButtons(sources).toJSON().components as unknown as
    { label: string; disabled?: boolean }[];
  return buttons.map((button) => [button.label, button.disabled ?? false]);
}

/** 지역 화면의 추가·제거·초기화 버튼이 잠겼는지 돌려준다. */
function editButtonStates(sub: AlarmSubscription): Record<"add" | "remove" | "clear", boolean> {
  const rows = subscribeManageButtons(sub).map((row) => row.toJSON());
  const buttons = rows.flatMap((row) => row.components) as unknown as
    { custom_id: string; disabled?: boolean }[];
  const disabled = (id: string) =>
    buttons.find((button) => button.custom_id === id)?.disabled ?? false;
  return {
    add: disabled(alertRegionEditActionId.ADD),
    remove: disabled(alertRegionEditActionId.REMOVE),
    clear: disabled(alertRegionEditActionId.CLEAR),
  };
}

export async function testSourceToggle(): Promise<boolean> {
  return runCases("공고 묶음 켜기/끄기", [
    {
      name: "묶음: 일반 공고에 sria, elias 공고에 elias. 권역이 겹치지 않음",
      run: () => {
        const [korea, elias] = getSourceToggles();
        expectEqual(korea.sources, ["sria"]);
        expectEqual(elias.sources, ["elias"]);
        expectEqual(elias.regionGroups, ["eliasRegions"]);
        expectEqual(korea.regionGroups.includes("eliasRegions"), false);
      },
    },
    {
      name: "저장값: 하나를 끄면 SELECTED, 다시 켜면 ALL",
      run: () => {
        expectEqual(toggleSourceFilter(ALL, "elias"), KOREA_ONLY);
        expectEqual(toggleSourceFilter(ALL, "korea"), ELIAS_ONLY);
        expectEqual(toggleSourceFilter(KOREA_ONLY, "elias"), ALL);
        expectEqual(toggleSourceFilter(ELIAS_ONLY, "korea"), ALL);
      },
    },
    {
      name: "마지막 묶음은 끌 수 없음: 계산은 null, 버튼은 잠김",
      run: () => {
        expectEqual(toggleSourceFilter(KOREA_ONLY, "korea"), null);
        expectEqual(toggleSourceFilter(ELIAS_ONLY, "elias"), null);
        expectEqual(buttonStates(ALL), [["✅ 일반 공고", false], ["✅ elias 공고", false]]);
        expectEqual(buttonStates(KOREA_ONLY), [["✅ 일반 공고", true], ["⬜ elias 공고", false]]);
        expectEqual(buttonStates(ELIAS_ONLY), [["⬜ 일반 공고", false], ["✅ elias 공고", true]]);
      },
    },
    {
      name: "지역 메뉴: 켜진 묶음의 권역만 보임",
      run: () => {
        expectEqual(menuValues(ALL).length, 11);
        expectEqual(menuValues(KOREA_ONLY).length, 10);
        expectEqual(menuValues(KOREA_ONLY).includes("eliasRegions"), false);
        expectEqual(menuValues(ELIAS_ONLY), ["eliasRegions"]);
      },
    },
    {
      name: "지역 메뉴: 켜진 묶음이 없는 문서는 권역 전체",
      run: () => {
        expectEqual(visibleRegionGroups({ mode: AlertMode.SELECTED, values: [] }).length, 11);
      },
    },
    {
      name: "알림 판정: 켜진 공고만 받고, 모든 지역이면 그 공고 전부",
      run: () => {
        const allRegions: AlarmFilter<CityEn> = { mode: AlertMode.ALL };
        expectEqual(matched(ALL, allRegions), [SRIA_SEOUL.id, ELIAS_FAIRY.id]);
        expectEqual(matched(KOREA_ONLY, allRegions), [SRIA_SEOUL.id]);
        expectEqual(matched(ELIAS_ONLY, allRegions), [ELIAS_FAIRY.id]);
      },
    },
    {
      name: "알림 판정: 서울을 골라도 elias 공고는 오지 않음",
      run: () => {
        const seoul: AlarmFilter<CityEn> = { mode: AlertMode.SELECTED, values: ["seoul"] };
        expectEqual(matched(ALL, seoul), [SRIA_SEOUL.id]);
        expectEqual(matched(ELIAS_ONLY, seoul), []);
      },
    },
    {
      name: "표시: 꺼진 공고의 지역은 화면에서 빠지고 저장값에는 남음",
      run: () => {
        const sub = subscription(ELIAS_ONLY, ["seoul", "fairyKingdom"]);
        expectEqual(activeRegions(sub), ["fairyKingdom"]);
        expectEqual(regionSummary(sub), "요정 왕국");
        expectEqual(selectedValues(sub.regions), ["seoul", "fairyKingdom"]);
      },
    },
    {
      name: "표시: 켜진 공고의 지역이 없으면 선택 없음으로 보이고 제거·초기화가 잠김",
      run: () => {
        const sub = subscription(ELIAS_ONLY, ["seoul"]);
        expectEqual(regionSummary(sub), "선택된 지역 없음");
        expectEqual(
          selectedRegionContent(activeRegionsByToggle(sub)).split("\n")[0],
          "⚠️ 선택된 지역이 없어 알림이 발송되지 않아요."
        );
        expectEqual(editButtonStates(sub), { add: false, remove: true, clear: true });
      },
    },
    {
      name: "순서: 공고 묶음별로 나누고 그 안은 가나다순. 저장 순서는 그대로",
      run: () => {
        const stored: CityEn[] = ["fairyKingdom", "chungju", "worldTreeOrder", "suwon"];
        const sub = subscription(ALL, stored);

        expectEqual(activeRegions(sub), ["suwon", "chungju", "worldTreeOrder", "fairyKingdom"]);
        expectEqual(regionSummary(sub), "수원, 충주, 세계수 교단, 요정 왕국");
        expectEqual(selectedValues(sub.regions), stored);
      },
    },
    {
      name: "설정 화면: 켜진 공고마다 한 줄, 고른 지역이 없으면 그 공고에 없다고 표시",
      run: () => {
        const both = subscription(ALL, ["fairyKingdom", "chungju", "worldTreeOrder", "suwon"]);
        expectEqual(selectedRegionContent(activeRegionsByToggle(both)).split("\n"), [
          "현재 선택 지역",
          "> 일반 공고: `수원` `충주`",
          "> elias 공고: `세계수 교단` `요정 왕국`",
          "(공고별 최대 2개까지 선택 가능)",
        ]);

        const eliasOnly = subscription(ELIAS_ONLY, ["suwon", "fairyKingdom"]);
        expectEqual(selectedRegionContent(activeRegionsByToggle(eliasOnly)).split("\n"), [
          "현재 선택 지역",
          "> elias 공고: `요정 왕국`",
          "(공고별 최대 2개까지 선택 가능)",
        ]);

        const koreaPicked = subscription(ALL, ["suwon"]);
        expectEqual(selectedRegionContent(activeRegionsByToggle(koreaPicked)).split("\n"), [
          "현재 선택 지역",
          "> 일반 공고: `수원`",
          "> elias 공고: 선택한 지역 없음",
          "(공고별 최대 2개까지 선택 가능)",
        ]);
      },
    },
    {
      name: "개수 제한: 꺼진 공고의 지역은 세지 않음",
      run: () => {
        const sub = subscription(ELIAS_ONLY, ["seoul", "suwon", "fairyKingdom"]);
        expectEqual(editButtonStates(sub).add, false);
      },
    },
    {
      name: "개수 제한: 공고별로 세고, 켜진 공고가 모두 차야 추가가 잠김",
      run: () => {
        const koreaFull: CityEn[] = ["seoul", "suwon"];
        expectEqual(isToggleFull(getSourceToggles()[0], koreaFull, 2), true);
        expectEqual(isToggleFull(getSourceToggles()[1], koreaFull, 2), false);
        expectEqual(editButtonStates(subscription(ALL, koreaFull)).add, false);
        expectEqual(editButtonStates(subscription(KOREA_ONLY, koreaFull)).add, true);
      },
    },
    {
      name: "지역이 속한 묶음을 찾음",
      run: () => {
        expectEqual(findRegionToggle("seoul")?.key, "korea");
        expectEqual(findRegionToggle("fairyKingdom")?.key, "elias");
      },
    },
    {
      name: "권역 화면 안내: 공고가 둘 다 켜져 있을 때만 공고 설명을 보여 줌",
      run: () => {
        expectEqual(regionGroupMenuContent(ALL).split("\n"), [
          "1/2단계 — 권역을 선택하세요",
          "> 일반 공고: 대한민국 지역의 공고",
          "> elias 공고: elias 지역의 공고",
        ]);
        expectEqual(regionGroupMenuContent(KOREA_ONLY), "1/2단계 — 권역을 선택하세요");
        expectEqual(regionGroupMenuContent(ELIAS_ONLY), "1/2단계 — 권역을 선택하세요");
      },
    },
    {
      name: "사이트 설정 안내: 공고마다 설명 한 줄을 인용 블록으로 보여 줌",
      run: () => {
        expectEqual(sourceDescriptions(), [
          "> 일반 공고: 대한민국 지역의 공고",
          "> elias 공고: elias 지역의 공고",
        ]);
      },
    },
    {
      name: "요약: 켜진 공고 이름",
      run: () => {
        expectEqual(sourceSummary(ALL), "모든 공고");
        expectEqual(sourceSummary(KOREA_ONLY), "일반 공고");
        expectEqual(sourceSummary(ELIAS_ONLY), "elias 공고");
      },
    },
    {
      name: "첫 구독: 일반 공고만 켜고 elias 지역은 메뉴에 없음",
      run: () => {
        const first = initialSourceFilter();
        expectEqual(first, { mode: AlertMode.SELECTED, values: ["sria"] });
        expectEqual(sourceSummary(first), "일반 공고");
        expectEqual(menuValues(first).includes("eliasRegions"), false);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testSourceToggle());
}

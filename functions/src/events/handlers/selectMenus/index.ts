import type { StringSelectMenuInteraction } from "discord.js";
import { onRegionGroupSelect } from "../../listeners/selectMenus/onRegionGroupSelect";
import { onRegionCitySelect } from "../../listeners/selectMenus/onRegionCitySelect";
import { onRegionRemoveSelect } from "../../listeners/selectMenus/onRegionRemoveSelect";
import { onSourceSelect } from "../../listeners/selectMenus/onSourceSelect";
import { SOURCE_SELECT_MENU_ID } from "@/providers/discord/builder/selectMenus/sourceSelectMenu";

export type SelectMenuHandler = (
  interaction: StringSelectMenuInteraction
) => unknown | Promise<unknown>;

/**
 * StringSelectMenu 제출 핸들러 맵.
 *
 * SelectMenu customId는 `isValidFullActionId` 게이트 밖이므로 `onInteraction`이
 * customId 키 일치로 직접 라우팅한다(모달과 동일 방식). 지역 선택은 권역→시 2단계 +
 * 제거의 3개 customId로 구성된다. 사이트 선택은 메뉴를 연 위치별 customId 2개가
 * 같은 핸들러를 쓴다.
 */
export const selectMenuHandlers: Record<string, SelectMenuHandler> = {
  "region-group-select": onRegionGroupSelect,
  "region-city-select": onRegionCitySelect,
  "region-remove-select": onRegionRemoveSelect,
  [SOURCE_SELECT_MENU_ID.MANAGE]: onSourceSelect,
  [SOURCE_SELECT_MENU_ID.FIRST]: onSourceSelect,
};

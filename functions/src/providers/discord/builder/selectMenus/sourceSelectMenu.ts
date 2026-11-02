import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmFilter, RecruitSource } from "@/common/types";
import { getSourceConfig, getUserFacingSources } from "@/providers/recruit";

/**
 * 사이트 선택 메뉴의 customId.
 *
 * 메뉴 제출 이벤트만으로는 어디서 열었는지 알 수 없다.
 * 저장한 뒤 돌아갈 화면이 다르므로 같은 메뉴를 customId 두 개로 나눈다.
 */
export const SOURCE_SELECT_MENU_ID = {
  MANAGE: "source-select", // 설정 관리 화면에서 연 메뉴
  FIRST: "source-select-first", // 첫 구독 질문에서 연 메뉴
} as const;

/**
 * 사이트 선택 메뉴와 함께 보여 줄 안내 문구.
 *
 * 전부 고르면 "전체"로 저장되어 나중에 추가되는 사이트도 받는다는 차이를 메뉴에서 알린다.
 */
export const SOURCE_SELECT_MENU_CONTENT = [
  "알림 받을 사이트를 1개 이상 고르세요",
  "모두 고르면 나중에 추가되는 사이트의 공고도 함께 받아요",
].join("\n");

/**
 * 사이트 선택 메뉴를 만든다.
 *
 * @param customId 메뉴를 연 위치에 맞는 `SOURCE_SELECT_MENU_ID` 값
 * @param current 현재 사이트 필터. ALL이면 전부, SELECTED면 `values`에 든 사이트를 미리 선택한다
 * @returns 노출 사이트만 옵션으로 가진 메뉴 행
 */
export function sourceSelectMenu(
  customId: (typeof SOURCE_SELECT_MENU_ID)[keyof typeof SOURCE_SELECT_MENU_ID],
  current: AlarmFilter<RecruitSource>,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const sources = getUserFacingSources();
  const selected = new Set(current.mode === AlertMode.ALL ? sources : current.values);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("사이트 선택")
    .setMinValues(1)
    .setMaxValues(sources.length)
    .addOptions(
      sources.map((source) => ({
        label: getSourceConfig(source).displayName,
        value: source,
        default: selected.has(source),
      }))
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

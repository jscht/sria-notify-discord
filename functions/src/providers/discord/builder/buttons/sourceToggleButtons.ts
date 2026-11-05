import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { AlarmFilter, RecruitSource } from "@/common/types";
import { sourceSelectActionId } from "@/features/alarmSubscribe/constants";
import {
  getSourceToggles,
  isToggleOn,
  type SourceToggleKey,
} from "@/providers/recruit/sourceToggle";

const TOGGLE_ACTION_ID: Record<SourceToggleKey, string> = {
  korea: sourceSelectActionId.TOGGLE_KOREA,
  elias: sourceSelectActionId.TOGGLE_ELIAS,
};

/**
 * 공고 묶음 켜기/끄기 버튼 행.
 *
 * 켜진 묶음이 하나뿐이면 그 버튼을 잠근다. 다 끄면 받을 공고가 없어지기 때문이다.
 * 알림을 완전히 끄는 것은 진입 화면의 끄기 버튼이 맡는다.
 *
 * @param filter 구독자 사이트 필터
 * @returns 묶음마다 버튼 하나인 행
 */
export function sourceToggleButtons(
  filter: AlarmFilter<RecruitSource>
): ActionRowBuilder<ButtonBuilder> {
  const toggles = getSourceToggles();
  const onCount = toggles.filter((toggle) => isToggleOn(toggle, filter)).length;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggles.map((toggle) => {
      const on = isToggleOn(toggle, filter);
      return new ButtonBuilder()
        .setCustomId(TOGGLE_ACTION_ID[toggle.key])
        .setLabel(`${on ? "✅" : "⬜"} ${toggle.label}`)
        .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(on && onCount === 1);
    })
  );
}

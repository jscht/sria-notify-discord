import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmSubscription } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { regionModeChangeActionId, subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import { MAX_REGION_COUNT } from "@/features/alarmSubscribe/commands/slashCommand";
import { alertRegionEditButtons } from "@/providers/discord/builder/buttons/alertRegionEditButtons";

/**
 * 지역 화면의 액션 버튼 행들.
 *
 * Row1: 🔀 모드 변경(OPEN) / ⬅️ 뒤로(MANAGE, 설정 관리 화면으로 돌아감)
 * Row2: SELECTED 모드일 때만 지역 편집 버튼(추가/제거/초기화) 추가.
 *
 * @param sub 사용자 알림 구독 정보
 */
export function subscribeManageButtons(sub: AlarmSubscription): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(regionModeChangeActionId.OPEN)
      .setLabel("🔀 모드 변경")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.MANAGE)
      .setLabel("⬅️ 뒤로")
      .setStyle(ButtonStyle.Secondary),
  );

  if (sub.regions.mode === AlertMode.SELECTED) {
    // 상한 도달 시 ➕추가를, 0개일 때 ➖제거·🧹초기화를 잠근다.
    const regions = selectedValues(sub.regions);
    const addDisabled = regions.length >= MAX_REGION_COUNT;
    const noRegions = regions.length === 0;
    return [row1, alertRegionEditButtons(true, addDisabled, noRegions)];
  }

  return [row1];
}

import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { subscribeOptionActionId } from "@/common/constants";

/**
 * 알림 옵션 선택 버튼
 * - 알림 켜기
 * - 설정 관리
 */
export function showSubscribeOptionButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.ENABLE)
      .setLabel("알림 켜기"),
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.MANAGE)
      .setLabel("설정 관리"),
  );
}

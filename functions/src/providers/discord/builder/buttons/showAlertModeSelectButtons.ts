import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { alertModeSelectActionId } from "@/features/alarmSubscribe/constants";

export function showAlertModeSelectButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(alertModeSelectActionId.ALL)
      .setLabel("모든 지역")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(alertModeSelectActionId.SELECTED)
      .setLabel("지역 선택")
      .setStyle(ButtonStyle.Secondary)
  );
}
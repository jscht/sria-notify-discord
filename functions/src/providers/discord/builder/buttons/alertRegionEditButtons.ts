import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { alertRegionEditActionId } from "../../../../constants/alertRegionEditAction";

export function alertRegionEditButtons(isSelectedRegionMode: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.ADD)
      .setLabel("➕ 추가"),
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.REMOVE)
      .setLabel("➖ 제거")
      .setDisabled(isSelectedRegionMode),
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.ADD)
      .setLabel("🧹 초기화")
      .setStyle(ButtonStyle.Danger)
  );
}
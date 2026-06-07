import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { alertRegionEditActionId } from "@/features/alarmSubscribe/constants";

export function alertRegionEditButtons(
  isSelectedRegionMode: boolean,
  addDisabled = false,
  noRegions = false,
) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.ADD)
      .setLabel("➕ 추가")
      .setStyle(ButtonStyle.Success)
      .setDisabled(addDisabled),
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.REMOVE)
      .setLabel("➖ 제거")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!isSelectedRegionMode || noRegions),
    new ButtonBuilder()
      .setCustomId(alertRegionEditActionId.CLEAR)
      .setLabel("🧹 초기화")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isSelectedRegionMode || noRegions)
  );
}
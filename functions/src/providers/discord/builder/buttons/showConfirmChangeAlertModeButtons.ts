import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { regionModeChangeActionId } from "../../../../constants/regionModeChangeAction";

export function showConfirmChangeAlertModeButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(regionModeChangeActionId.CANCEL)
      .setLabel("취소")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(regionModeChangeActionId.CONFIRM)
      .setLabel("네, 변경할래요")
      .setStyle(ButtonStyle.Primary),
  );
};
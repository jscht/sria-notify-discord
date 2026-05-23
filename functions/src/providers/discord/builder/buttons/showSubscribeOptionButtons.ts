import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";

export function showSubscribeOptionButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.ENABLE)
      .setLabel("알림 켜기")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.MANAGE)
      .setLabel("설정 관리")
      .setStyle(ButtonStyle.Secondary),
  );
}
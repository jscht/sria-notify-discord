import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";

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
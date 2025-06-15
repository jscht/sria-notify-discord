import { SlashCommandBuilder } from "discord.js";
import { DiscordBotCommand } from "../../../constants/discordBotCommand";

export enum AlarmSubscribeCommandAction {
  ADD = "add",
  REMOVE = "remove",
  CLEAR = "clear",
};

export const MAX_REGION_COUNT = 2;

export const alarmSubscribeCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.ALARM_SUBSCRIBE)
  .setDescription("공고 알림을 설정합니다.")
  .addStringOption(option =>
    option.setName("작업")
      .setDescription("추가: add, 제거: remove, 전부 제거: clear")
      .setRequired(true)
      .addChoices(
        { name: "➕ 추가", value: AlarmSubscribeCommandAction.ADD },
        { name: "➖ 제거", value: AlarmSubscribeCommandAction.REMOVE },
        { name: "🧹 전부 제거", value: AlarmSubscribeCommandAction.CLEAR },
      )
  )
  .addStringOption(option =>
    option.setName("지역")
      .setDescription("설정하거나 제거할 지역 (clear 작업 시 생략)")
      .setRequired(false)
  );
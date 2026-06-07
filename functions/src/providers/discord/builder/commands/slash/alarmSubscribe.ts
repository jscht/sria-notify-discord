import { SlashCommandBuilder } from "discord.js";
import { DiscordBotCommand } from "@/providers/discord/constants";

export const alarmSubscribeCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.ALARM_SUBSCRIBE)
  .setDescription("공고 알림을 설정합니다.");

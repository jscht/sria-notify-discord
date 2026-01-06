import { SlashCommandBuilder, APIApplicationCommandOptionChoice } from "discord.js";
import { DiscordBotCommand } from "@/providers/discord/constants";
import type { SubscribeCommand } from "../types";

export const MAX_REGION_COUNT = 2;

const subscribeChoices: APIApplicationCommandOptionChoice<SubscribeCommand>[] = [
  { name: "🌐 전체 지역 알림 받기", value: "ALL" },
  { name: "📍 내가 선택한 지역만 알림 받기", value: "SELECTED_REGIONS" },
];

export const alarmSubscribeCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.ALARM_SUBSCRIBE)
  .setDescription("공고 알림을 설정합니다.")
  .addStringOption(option =>
    option
      .setName("모드")
      .setDescription("알림 받을 방식을 선택하세요.")
      .setRequired(true)
      .addChoices(...subscribeChoices)
  );

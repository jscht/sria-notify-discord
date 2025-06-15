import { SlashCommandBuilder } from "discord.js";
import { DiscordBotCommand } from "../../../constants/discordBotCommand";

export const recruitRequestCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.RECRUIT_REQUEST)
  .setDescription("해당 지역의 공고를 요청합니다.")
  .addStringOption(option =>
    option.setName("지역")
      .setDescription("조회할 지역명")
      .setRequired(false)
  );
import { CommandInteraction } from "discord.js";
import { DiscordBotCommand } from "../../constants/discordBotCommand";
import { onRecruitRequest } from "./onRecruitRequest";
import { onAlarmSubscribeCommand } from "./onAlarmSubscribe";

export const handlers: Record<DiscordBotCommand, (interaction: CommandInteraction) => Promise<void>> = {
  [DiscordBotCommand.RECRUIT_REQUEST]: onRecruitRequest,
  [DiscordBotCommand.ALARM_SUBSCRIBE]: onAlarmSubscribeCommand
};
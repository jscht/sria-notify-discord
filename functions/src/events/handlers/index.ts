import { CommandInteraction } from "discord.js";
import { DiscordBotCommand } from "../../providers/discord/commands";
import { onRecruitRequest } from "./onRecruitRequest";
import { onAlarmSubscribeCommand } from "./onAlarmSubscribe";

export const handlers: Record<DiscordBotCommand, (interaction: CommandInteraction) => Promise<void>> = {
  [DiscordBotCommand.RecruitRequest]: onRecruitRequest,
  [DiscordBotCommand.AlarmSubscribe]: onAlarmSubscribeCommand
};
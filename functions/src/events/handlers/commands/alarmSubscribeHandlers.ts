import { DiscordBotCommand } from "../../../constants/discordBotCommand";
import { onAlarmSubscribe } from "../../listeners/commands/onAlarmSubscribe";

export const alarmSubscribeCommandHandlers = {
  [DiscordBotCommand.ALARM_SUBSCRIBE]: onAlarmSubscribe,
} as const;
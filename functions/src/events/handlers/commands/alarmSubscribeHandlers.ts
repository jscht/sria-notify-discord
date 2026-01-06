import { DiscordBotCommand } from "@/common/constants";
import { onAlarmSubscribe } from "../../listeners/commands/onAlarmSubscribe";

export const alarmSubscribeCommandHandlers = {
  [DiscordBotCommand.ALARM_SUBSCRIBE]: onAlarmSubscribe,
} as const;
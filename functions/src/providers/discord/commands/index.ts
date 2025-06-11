import { recruitRequestCommand } from "./recruitRequest";
import { alarmSubscribeCommand } from "./alarmSubscribe";

export enum DiscordBotCommand {
  RecruitRequest = "공고요청",
  AlarmSubscribe = "알림설정",
}

export const commands = [
  recruitRequestCommand,
  alarmSubscribeCommand
];
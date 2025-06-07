import { CommandInteraction } from "discord.js";
import { postCommand, handlePostCommand } from "./post";
import { notificationCommand, handleNotificationCommand } from "./notification";

export enum DiscordBotCommand {
  Post = "공고요청",
  Notification = "알림설정",
}

export const commands = [
  postCommand,
  notificationCommand
];

export const handlers: Record<DiscordBotCommand, (interaction: CommandInteraction) => Promise<void>> = {
  [DiscordBotCommand.Post]: handlePostCommand,
  [DiscordBotCommand.Notification]: handleNotificationCommand
};
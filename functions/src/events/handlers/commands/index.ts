import type { CommandInteraction } from "discord.js";
import { recruitCommandHandlers } from "./recruitRequestHandlers";
import { alarmSubscribeCommandHandlers } from "./alarmSubscribeHandlers";

export type CommandHandler = (interaction: CommandInteraction) => Promise<void>;

export const commandHandlers: Record<string, CommandHandler> = {
  ...recruitCommandHandlers,
  ...alarmSubscribeCommandHandlers,
};
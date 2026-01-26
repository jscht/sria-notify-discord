import type { ClientEvents } from "discord.js";

export interface DiscordEventHandler {
  event: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}
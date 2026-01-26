import { Events, Client } from "discord.js";
import { DiscordEventHandler } from "./discordEventHandler";

export const onReady = (): DiscordEventHandler => ({
  event: Events.ClientReady,
  once: true,
  execute: (client: Client) => {
    DebugLogger.provider(`Ready! Logged in as ${client.user?.tag}`, "discord");
  },
});
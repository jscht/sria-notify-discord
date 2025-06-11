import { Events, Client } from "discord.js";
import { EventHandler } from "./eventHandler";

export const onReady = (): EventHandler => ({
  event: Events.ClientReady,
  once: true,
  execute: (client: Client) => {
    DebugLogger.provider(`Ready! Logged in as ${client.user?.tag}`, "discord");
  },
});
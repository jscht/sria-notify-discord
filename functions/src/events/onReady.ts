import { Events, Client } from "discord.js";
import { EventHandler } from "./eventHandler";

export const onReady = (): EventHandler => ({
  event: Events.ClientReady,
  once: true,
  execute: (client: Client) => {
    createGlobalLogger('provider').debug(`Ready! Logged in as ${client.user?.tag}`, "discord");
  },
});
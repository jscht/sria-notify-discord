import { Events, Client } from "discord.js";
import { providerLogger } from "@/common/utils/systemLogger";
import { DiscordEventHandler } from "./discordEventHandler";

export const onReady = (): DiscordEventHandler => ({
  event: Events.ClientReady,
  once: true,
  execute: (client: Client) => {
    providerLogger.debug(`Ready! Logged in as ${client.user?.tag}`);
  },
});
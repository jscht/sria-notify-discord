import { Events, Message } from "discord.js";
import { DiscordEventHandler } from "./discordEventHandler";

export const onPingPongCreate = (): DiscordEventHandler => ({
  event: Events.MessageCreate,
  execute: (message: Message) => {
    if (message.content === "ping") {
      message.reply("pong");
    }
  },
});
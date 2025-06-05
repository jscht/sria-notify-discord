import { Events, Message } from "discord.js";
import { EventHandler } from "./eventHandler";

export const onPingPongCreate = (): EventHandler => ({
  event: Events.MessageCreate,
  execute: (message: Message) => {
    if (message.content === "ping") {
      message.reply("pong");
    }
  },
});
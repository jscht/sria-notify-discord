import { client } from "./client";
import { events } from "./events";

export function initDiscordBot() {
  for (const { once, event, execute } of events) {
    if (once) {
      client.once(event, execute);
    } else {
      client.on(event, execute);
    }
  }

  client.login(process.env.SARIAN_BOT_TOKEN);
  DebugLogger.provider("info: login success!", "discord");
}
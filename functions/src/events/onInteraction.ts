import { Events, Interaction, CommandInteraction } from "discord.js";
import { DiscordBotCommand } from "../providers/discord/commands";
import { EventHandler } from "./eventHandler";
import { handlers } from "./handlers";

export const onInteraction = (): EventHandler => ({
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName as DiscordBotCommand;

    const handler = handlers[commandName];
    if (handler) {
      await handler(interaction as CommandInteraction);
    }
  },
});
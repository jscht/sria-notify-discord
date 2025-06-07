import { Events, Interaction, CommandInteraction } from "discord.js";
import { DiscordBotCommand, handlers } from "../commands";
import { EventHandler } from "./eventHandler";

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
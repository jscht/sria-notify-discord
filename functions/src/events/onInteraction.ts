import { 
  Events, Interaction, CommandInteraction, MessageFlags, 
  ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction 
} from "discord.js";
import { EventHandler } from "./eventHandler";
import { commandHandlers } from "./handlers/commands";
import { buttonHandlers } from "./handlers/buttons";
import { modalHandler } from "./handlers/modals";
import { isValidFullActionId } from "@/common/utils";
import { DiscordBotCommand } from "@/providers/discord/constants";

export const onInteraction = (): EventHandler => ({
  event: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    try {
      /** 🔹 슬래시 명령어 (Chat Input Command) */
      if (interaction.isChatInputCommand()) {
        const commandName = interaction.commandName as DiscordBotCommand;
        const handler = commandHandlers[commandName];
        if (handler) {
          await handler(interaction as CommandInteraction);
        }
        return;
      }

      /** 🔹 버튼 (Button Interaction) */
      if (interaction.isButton()) {
        const actionId = interaction.customId;
        if (!isValidFullActionId(actionId)) {
          throw new Error("inValid actionId");
        }
        const handler = buttonHandlers[actionId];
        if (handler) {
          await handler(interaction as ButtonInteraction);
        }
        return;
      }

      /** 🔹 모달 (Modal Submit Interaction) */
      if (interaction.isModalSubmit()) {
        const actionId = interaction.customId;
        const handler = modalHandler[actionId];
        if (handler) {
          await handler(interaction as ModalSubmitInteraction);
        }
        return;
      }

      /** 🔹 셀렉트 메뉴 (String Select Menu Interaction) */
      if (interaction.isStringSelectMenu()) {
        const actionId = interaction.customId;
        const handler = stringSelectHandler[actionId];
        if (handler) {
          await handler(interaction as StringSelectMenuInteraction);
        }
        return;
      }

    } catch (error) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: "⚠️ 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
      throw new Error("❌ Interaction handler error");
    }
  },
});
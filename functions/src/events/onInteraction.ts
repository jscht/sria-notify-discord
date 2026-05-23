import {
  Events, Interaction, CommandInteraction, MessageFlags,
  ButtonInteraction, ModalSubmitInteraction
} from "discord.js";
import { DiscordEventHandler } from "./discordEventHandler";
import { commandHandlers } from "./handlers/commands";
import { buttonHandlers } from "./handlers/buttons";
import { modalHandler } from "./handlers/modals";
import { isValidFullActionId } from "@/common/utils";
import { providerLogger } from "@/common/utils/systemLogger";
import { DiscordBotCommand } from "@/providers/discord/constants";

export const onInteraction = (): DiscordEventHandler => ({
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

      // Phase 1.5: StringSelectMenu 핸들러는 SubscriptionService 연동 시 도입 예정
    } catch (error) {
      const context: Record<string, unknown> = {
        type: interaction.type,
        id: interaction.id,
      };
      if (interaction.isChatInputCommand()) {
        context.commandName = interaction.commandName;
      } else if (interaction.isButton() || interaction.isModalSubmit()) {
        context.customId = interaction.customId;
      }
      providerLogger.error("Interaction handler error", error as Error, context);

      if (interaction.isRepliable()) {
        await interaction.reply({
          content: "⚠️ 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    }
  },
});
import type { ModalSubmitInteraction } from "discord.js";

export type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>;

export const modalHandler: Record<string, ModalHandler> = {};
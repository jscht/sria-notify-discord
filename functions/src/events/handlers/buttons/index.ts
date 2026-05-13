import type { ButtonInteraction } from "discord.js";
import { regionModeConfirmHandlers } from "./regionModeChangeConfirmHandlers";
import { alertRegionEditHandlers } from "./alertRegionEditHandlers";
import { subscribeOptionHandlers } from "./showSubscribeOptionHandler";
import { alertModeSelectHandlers } from "./alertModeSelectHandlers";

export type ButtonHandler = (interaction: ButtonInteraction) => unknown | Promise<unknown>;

export const buttonHandlers: Record<string, ButtonHandler> = {
  ...regionModeConfirmHandlers,
  ...alertRegionEditHandlers,
  ...subscribeOptionHandlers,
  ...alertModeSelectHandlers,
};
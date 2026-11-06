import type { ButtonInteraction } from "discord.js";
import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onSourceSelectOpen } from "../../listeners/buttons/onSourceSelectOpen";
import { onSourceToggle } from "../../listeners/buttons/onSourceToggle";

export const sourceSelectHandlers = {
  [fullActionId.SOURCE_SELECT_OPEN]: onSourceSelectOpen,
  [fullActionId.SOURCE_SELECT_TOGGLE_KOREA]: (i: ButtonInteraction) => onSourceToggle(i, "korea"),
  [fullActionId.SOURCE_SELECT_TOGGLE_ELIAS]: (i: ButtonInteraction) => onSourceToggle(i, "elias"),
} as const;

import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onSourceSelectKeepAll } from "../../listeners/buttons/onSourceSelectKeepAll";
import { onSourceSelectOpen } from "../../listeners/buttons/onSourceSelectOpen";
import { onSourceSelectPick } from "../../listeners/buttons/onSourceSelectPick";

export const sourceSelectHandlers = {
  [fullActionId.SOURCE_SELECT_OPEN]: onSourceSelectOpen,
  [fullActionId.SOURCE_SELECT_PICK]: onSourceSelectPick,
  [fullActionId.SOURCE_SELECT_KEEP_ALL]: onSourceSelectKeepAll,
} as const;

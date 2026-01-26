import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onChangeCancel } from "../../listeners/buttons/onChangeCancel";
import { onChangeConfirm } from "../../listeners/buttons/onChangeConfirm";

export const regionModeConfirmHandlers = {
  [fullActionId.REGION_MODE_CHANGE_CONFIRM]: onChangeConfirm,
  [fullActionId.REGION_MODE_CHANGE_CANCEL]: onChangeCancel,
} as const;
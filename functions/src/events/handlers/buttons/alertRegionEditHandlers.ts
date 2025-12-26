import { fullActionId } from "../../fullActionId";
import { onAlertRegionEdit } from "../../listeners/buttons/onAlertRegionEdit";

export const alertRegionEditHandlers = {
  [fullActionId.REGION_EDIT_ADD]: onAlertRegionEdit,
  [fullActionId.REGION_EDIT_REMOVE]: onAlertRegionEdit,
  [fullActionId.REGION_EDIT_CLEAR]: onAlertRegionEdit
} as const;
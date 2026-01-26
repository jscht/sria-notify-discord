import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onEnableAllRegionAlert } from "../../listeners/buttons/onEnableAllRegionAlert";
import { onEnableSelectedRegionAlert } from "../../listeners/buttons/onEnableSelectedRegionAlert";

export const alertModeSelectHandlers = {
  [fullActionId.ALERT_MODE_ALL]: onEnableAllRegionAlert,
  [fullActionId.ALERT_MODE_SELECTED]: onEnableSelectedRegionAlert
} as const;
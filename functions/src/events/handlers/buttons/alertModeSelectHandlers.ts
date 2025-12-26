import { fullActionId } from "../../fullActionId";
import { onEnableAllRegionAlert } from "../../listeners/buttons/onEnableAllRegionAlert";
import { onEnableSelectedRegionAlert } from "../../listeners/buttons/onEnableSelectedRegionAlert";

export const alertModeSelectHandlers = {
  [fullActionId.ALERT_MODE_SELECT_ALL]: onEnableAllRegionAlert,
  [fullActionId.ALERT_MODE_SELECT_SELECTED]: onEnableSelectedRegionAlert
} as const;
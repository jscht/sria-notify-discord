import { alertModeSelectActionId } from "../constants/alertModeSelectAction";
import { alertRegionEditActionId } from "../constants/alertRegionEditAction";
import { regionModeChangeActionId } from "../constants/regionModeChangeAction";
import { subscribeOptionActionId } from "../constants/subscribeOptionAction";

export const fullActionId = {
  // REGION_EDIT
  REGION_EDIT_ADD: alertRegionEditActionId.ADD,
  REGION_EDIT_REMOVE: alertRegionEditActionId.REMOVE,
  REGION_EDIT_CLEAR: alertRegionEditActionId.CLEAR,

  // REGION_MODE_CHANGE
  REGION_MODE_CHANGE_CONFIRM: regionModeChangeActionId.CONFIRM,
  REGION_MODE_CHANGE_CANCEL: regionModeChangeActionId.CANCEL,

  // SUBSCRIBE_OPTION
  SUBSCRIBE_OPTION_ENABLE: subscribeOptionActionId.ENABLE,
  SUBSCRIBE_OPTION_MANAGE: subscribeOptionActionId.MANAGE,

  // ALERT_MODE_SELECT
  ALERT_MODE_SELECT_ALL: alertModeSelectActionId.ALL,
  ALERT_MODE_SELECT_SELECTED: alertModeSelectActionId.SELECTED,
} as const;

export type FullActionId = typeof fullActionId[keyof typeof fullActionId];
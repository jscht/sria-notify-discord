const ALERT_REGION_EDIT_PREFIX = "REGION_EDIT" as const;

enum AlertRegionEditAction {
  ADD = "ADD",
  REMOVE = "REMOVE",
  CLEAR = "CLEAR"
}

export const alertRegionEditActionId = {
  ADD: `${ALERT_REGION_EDIT_PREFIX}:${AlertRegionEditAction.ADD}`,
  REMOVE: `${ALERT_REGION_EDIT_PREFIX}:${AlertRegionEditAction.REMOVE}`,
  CLEAR: `${ALERT_REGION_EDIT_PREFIX}:${AlertRegionEditAction.CLEAR}`
} as const

export type AlertRegionEditActionId 
  = typeof alertRegionEditActionId[keyof typeof alertRegionEditActionId];

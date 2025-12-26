const REGION_MODE_CHANGE_PREFIX = "REGION_MODE_CHANGE" as const;

enum RegionModeChangeAction {
  CONFIRM = "CONFIRM",
  CANCEL = "CANCEL"
}

export const regionModeChangeActionId = {
  CONFIRM: `${REGION_MODE_CHANGE_PREFIX}:${RegionModeChangeAction.CONFIRM}`,
  CANCEL: `${REGION_MODE_CHANGE_PREFIX}:${RegionModeChangeAction.CANCEL}`
} as const

export type RegionModeChangeActionId 
  = typeof regionModeChangeActionId[keyof typeof regionModeChangeActionId];
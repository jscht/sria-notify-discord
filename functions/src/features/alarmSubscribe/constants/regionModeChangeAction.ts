export const REGION_MODE_CHANGE_PREFIX = "REGION_MODE_CHANGE" as const;

export enum RegionModeChangeAction {
  CONFIRM = "CONFIRM",
  CANCEL = "CANCEL"
}

export const regionModeChangeActionId = {
  CONFIRM: `${REGION_MODE_CHANGE_PREFIX}:${RegionModeChangeAction.CONFIRM}`,
  CANCEL: `${REGION_MODE_CHANGE_PREFIX}:${RegionModeChangeAction.CANCEL}`
} as const

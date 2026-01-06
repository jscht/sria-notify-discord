export const ALERT_MODE_SELECT_PREFIX = "ALERT_MODE" as const;

export enum AlertModeSelectAction {
  ALL = "ALL",          // 모든 지역 알림
  SELECTED = "SELECTED_REGIONS" // 선택 지역 알림
}

export const alertModeSelectActionId = {
  ALL: `${ALERT_MODE_SELECT_PREFIX}:${AlertModeSelectAction.ALL}`,
  SELECTED: `${ALERT_MODE_SELECT_PREFIX}:${AlertModeSelectAction.SELECTED}`
} as const;

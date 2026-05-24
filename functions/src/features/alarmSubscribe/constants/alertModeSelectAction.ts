import { AlertMode } from "@/common/types";

export const ALERT_MODE_SELECT_PREFIX = "ALERT_MODE" as const;

/**
 * 알림 모드 선택 버튼의 customId 매핑
 *
 * `AlertMode` 상수 객체를 직접 참조하여 도메인-UI 값 일관성 보장.
 * 결과 customId:
 *   - alertModeSelectActionId.ALL      = "ALERT_MODE:ALL"
 *   - alertModeSelectActionId.SELECTED = "ALERT_MODE:SELECTED"
 */
export const alertModeSelectActionId = {
  ALL: `${ALERT_MODE_SELECT_PREFIX}:${AlertMode.ALL}`,
  SELECTED: `${ALERT_MODE_SELECT_PREFIX}:${AlertMode.SELECTED}`,
} as const;

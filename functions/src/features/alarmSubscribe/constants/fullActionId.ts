import { 
  ALERT_REGION_EDIT_PREFIX, 
  REGION_MODE_CHANGE_PREFIX, 
  SUBSCRIBE_OPTION_PREFIX, 
  ALERT_MODE_SELECT_PREFIX,
  alertModeSelectActionId, 
  alertRegionEditActionId, 
  regionModeChangeActionId, 
  subscribeOptionActionId
} from "../constants";

// TODO: 액션 ID 관리 용이성을 위해 리팩토링 고려 - prefix 별로 분리해놓고 합치는 방식

export const fullActionId = {
  // REGION_EDIT
  REGION_EDIT_ADD: alertRegionEditActionId.ADD,
  REGION_EDIT_REMOVE: alertRegionEditActionId.REMOVE,
  REGION_EDIT_CLEAR: alertRegionEditActionId.CLEAR,

  // REGION_MODE_CHANGE
  REGION_MODE_CHANGE_CONFIRM: regionModeChangeActionId.CONFIRM,
  REGION_MODE_CHANGE_CANCEL: regionModeChangeActionId.CANCEL,
  REGION_MODE_CHANGE_OPEN: regionModeChangeActionId.OPEN,

  // SUBSCRIBE_OPTION
  SUBSCRIBE_OPTION_ENABLE: subscribeOptionActionId.ENABLE,
  SUBSCRIBE_OPTION_MANAGE: subscribeOptionActionId.MANAGE,
  SUBSCRIBE_OPTION_DISABLE: subscribeOptionActionId.DISABLE,
  SUBSCRIBE_OPTION_BACK: subscribeOptionActionId.BACK,

  // ALERT_MODE
  ALERT_MODE_ALL: alertModeSelectActionId.ALL,
  ALERT_MODE_SELECTED: alertModeSelectActionId.SELECTED,
} as const;

// ============================================
// Type Utilities
// ============================================

/** 전체 FullActionId 유니온 타입 */
export type FullActionId = typeof fullActionId[keyof typeof fullActionId];

/** prefix로 FullActionId 필터링하는 유틸리티 타입 */
export type ExtractByPrefix<P extends string> = 
  Extract<FullActionId, `${P}:${string}`>;

// ============================================
// Prefix 기반 Action ID 타입
// ============================================

/** "REGION_EDIT:ADD" | "REGION_EDIT:REMOVE" | "REGION_EDIT:CLEAR" */
export type RegionEditActionId = ExtractByPrefix<typeof ALERT_REGION_EDIT_PREFIX>;

/** "ALERT_MODE:ALL" | "ALERT_MODE:SELECTED" */
export type AlertModeActionId = ExtractByPrefix<typeof ALERT_MODE_SELECT_PREFIX>;

/** "REGION_MODE_CHANGE:CONFIRM" | "REGION_MODE_CHANGE:CANCEL" */
export type RegionModeChangeActionId = ExtractByPrefix<typeof REGION_MODE_CHANGE_PREFIX>;

/** "SUBSCRIBE_OPTION:ENABLE" | "SUBSCRIBE_OPTION:MANAGE" */
export type SubscribeOptionActionId = ExtractByPrefix<typeof SUBSCRIBE_OPTION_PREFIX>;

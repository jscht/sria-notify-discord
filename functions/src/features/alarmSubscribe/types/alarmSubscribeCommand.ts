import { AlertMode } from "@/common/types";
import {
  fullActionId,
  RegionEditActionId
} from "../constants/fullActionId";

/**
 * @deprecated 새 코드는 `AlertMode`를 직접 사용. 기존 호출자 호환을 위해 별칭 유지.
 */
export type SubscribeCommand = AlertMode;

/**
 * 구독 모드별 허용되는 액션 매핑
 * - ALL 모드: 추가, 초기화만 가능
 * - SELECTED 모드: 추가, 삭제, 초기화 모두 가능
 */
type CommandActionMap = {
  ALL: Extract<
    RegionEditActionId,
    typeof fullActionId.REGION_EDIT_ADD | typeof fullActionId.REGION_EDIT_CLEAR
  >;
  SELECTED: RegionEditActionId;
};

/** 구독 모드에 따라 허용되는 액션 타입 */
export type AlarmSubscribeAction<C extends AlertMode> = CommandActionMap[C];

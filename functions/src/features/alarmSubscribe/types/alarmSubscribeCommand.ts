import {
  fullActionId,
  RegionEditActionId
} from "../constants/fullActionId";
import { AlertModeSelectAction } from "../constants";

/** 구독 모드 타입 */
export type SubscribeCommand = 
  | AlertModeSelectAction.ALL 
  | AlertModeSelectAction.SELECTED;

/** 
 * 구독 모드별 허용되는 액션 매핑
 * - ALL 모드: 추가, 초기화만 가능
 * - SELECTED 모드: 추가, 삭제, 초기화 모두 가능
 */
type CommandActionMap = {
  [AlertModeSelectAction.ALL]: Extract<
    RegionEditActionId, 
    typeof fullActionId.REGION_EDIT_ADD | typeof fullActionId.REGION_EDIT_CLEAR
  >;
  [AlertModeSelectAction.SELECTED]: RegionEditActionId;
};

/** 구독 모드에 따라 허용되는 액션 타입 */
export type AlarmSubscribeAction<C extends SubscribeCommand> = CommandActionMap[C];

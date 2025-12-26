import { AlertModeSelectAction } from "./alertModeSelectAction";
import { AlertRegionEditActionId } from "./alertRegionEditAction";

export type SubscribeCommand = 
  | AlertModeSelectAction.ALL 
  | AlertModeSelectAction.SELECTED;

type CommandActionMap = {
  [AlertModeSelectAction.ALL]: Extract<
    AlertRegionEditActionId, 
    "REGION_EDIT:ADD" | "REGION_EDIT:CLEAR"
  >;
  [AlertModeSelectAction.SELECTED]: AlertRegionEditActionId;
};

export type AlarmSubscribeActions<C extends SubscribeCommand> = 
  CommandActionMap[C];

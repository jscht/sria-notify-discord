import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { subscribeAdd, SubscribeAddPayload } from "./subscribeAdd";
import { subscribeRemove, SubscribeRemovePayload } from "./subscribeRemove";
import { subscribeClear, SubscribeClearPayload } from "./subscribeClear";

export type OnAlertRegionEditPayload = 
  | {
      action: typeof fullActionId.REGION_EDIT_ADD;
      payload: SubscribeAddPayload;
    }
  | {
      action: typeof fullActionId.REGION_EDIT_REMOVE;
      payload: SubscribeRemovePayload;
    }
  | {
      action: typeof fullActionId.REGION_EDIT_CLEAR;
      payload: SubscribeClearPayload;
    };

export function onAlertRegionEdit({ action, payload }: OnAlertRegionEditPayload): Promise<void> {
  switch(action) {
    case "REGION_EDIT:ADD":
      return subscribeAdd(payload);
    case "REGION_EDIT:REMOVE":
      return subscribeRemove(payload);
    case "REGION_EDIT:CLEAR":
      return subscribeClear(payload);
    default:
      throw new Error(`Unknown alert region edit action: ${action}`);
  }
}
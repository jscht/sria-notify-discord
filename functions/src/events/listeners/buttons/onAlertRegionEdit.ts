import { fullActionId } from "../../fullActionId";
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

export function onAlertRegionEdit({ action, payload }: OnAlertRegionEditPayload) {
  switch(action) {
    case "REGION_EDIT:ADD":
      subscribeAdd(payload);
      break;
    case "REGION_EDIT:REMOVE":
      subscribeRemove(payload);
      break;
    case "REGION_EDIT:CLEAR":
      subscribeClear(payload);
      break;
    default:
      throw new Error(`Unknown alert region edit action: ${action}`);
  }
}
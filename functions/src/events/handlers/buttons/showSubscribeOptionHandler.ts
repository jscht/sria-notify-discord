import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onShowSubscribeEnable } from "../../listeners/buttons/onShowSubscribeEnable";
import { onShowSubscribeManage } from "../../listeners/buttons/onShowSubscribeManage";

export const subscribeOptionHandlers = {
  [fullActionId.SUBSCRIBE_OPTION_ENABLE]: onShowSubscribeEnable,
  [fullActionId.SUBSCRIBE_OPTION_MANAGE]: onShowSubscribeManage
} as const
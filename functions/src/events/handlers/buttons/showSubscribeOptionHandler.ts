import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onDisableSubscribe } from "../../listeners/buttons/onDisableSubscribe";
import { onShowRegionSettings } from "../../listeners/buttons/onShowRegionSettings";
import { onShowSubscribeEnable } from "../../listeners/buttons/onShowSubscribeEnable";
import { onShowSubscribeManage } from "../../listeners/buttons/onShowSubscribeManage";
import { onSubscribeBack } from "../../listeners/buttons/onSubscribeBack";

export const subscribeOptionHandlers = {
  [fullActionId.SUBSCRIBE_OPTION_ENABLE]: onShowSubscribeEnable,
  [fullActionId.SUBSCRIBE_OPTION_MANAGE]: onShowSubscribeManage,
  [fullActionId.SUBSCRIBE_OPTION_REGION]: onShowRegionSettings,
  [fullActionId.SUBSCRIBE_OPTION_DISABLE]: onDisableSubscribe,
  [fullActionId.SUBSCRIBE_OPTION_BACK]: onSubscribeBack,
} as const;

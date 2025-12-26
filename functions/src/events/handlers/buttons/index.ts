import { regionModeConfirmHandlers } from "./regionModeChangeConfirmHandlers";
import { alertRegionEditHandlers } from "./alertRegionEditHandlers";
import { subscribeOptionHandlers } from "./showSubscribeOptionHandler";
import { alertModeSelectHandlers } from "./alertModeSelectHandlers";

export const buttonHandlers = {
  ...regionModeConfirmHandlers,
  ...alertRegionEditHandlers,
  ...subscribeOptionHandlers,
  ...alertModeSelectHandlers,
};
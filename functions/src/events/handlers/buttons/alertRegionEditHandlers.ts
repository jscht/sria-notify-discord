import type { ButtonInteraction } from "discord.js";
import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";

// Phase 1.5: SubscriptionService 연동과 함께 onAlertRegionEdit payload 추출 로직 도입 예정
const notImplemented = (_interaction: ButtonInteraction): never => {
  throw new Error("alertRegionEdit handler: not yet implemented (Phase 1.5)");
};

export const alertRegionEditHandlers = {
  [fullActionId.REGION_EDIT_ADD]: notImplemented,
  [fullActionId.REGION_EDIT_REMOVE]: notImplemented,
  [fullActionId.REGION_EDIT_CLEAR]: notImplemented,
};

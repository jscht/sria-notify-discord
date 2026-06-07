/**
 * Alarm Subscribe Feature
 * 사용자의 공고 알림 구독 기능
 */

// Commands
export { MAX_REGION_COUNT } from "./commands/slashCommand";

// Services
export { alarmSubscriptionService, AlarmSubscriptionService } from "./services/subscriptionService";

// AI
export { handleAlarmAI } from "./ai/handler";
export { interpretAlarmMessage } from "./ai/interpreter";
export { ALARM_INTENTS } from "./ai/intents";

// Types
export type { 
  SubscribeCommand, AlarmSubscribeAction, AlarmSubscription, AlarmSubscriptionInput, 
} from "./types";

// Constants
export {
  alertModeSelectActionId,
  alertRegionEditActionId,
  regionModeChangeActionId,
  subscribeOptionActionId,
} from "./constants";

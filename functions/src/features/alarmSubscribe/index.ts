/**
 * Alarm Subscribe Feature
 * 사용자의 공고 알림 구독 기능
 */

// Commands
export { alarmSubscribeCommand, MAX_REGION_COUNT } from "./commands/slashCommand";

// Interactions
export { showSubscribeOptionButtons } from "./interactions/buttons";
export { regionSelectModal } from "./interactions/modals";

// Handlers
export { onAlarmSubscribe } from "./handlers/commandHandler";
export { onSubscribeOptionButton } from "./handlers/buttonHandler";
export { onRegionSelectModal } from "./handlers/modalHandler";

// Services
export { alarmSubscriptionService, AlarmSubscriptionService } from "./services/subscriptionService";

// AI
export { handleAlarmAI } from "./ai/handler";
export { interpretAlarmMessage } from "./ai/interpreter";
export { ALARM_INTENTS } from "./ai/intents";

// Types
export type { SubscribeCommand, AlarmSubscription, AlarmSubscriptionInput } from "./types";

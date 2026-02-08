/**
 * Events 레이어 통합 진입점
 *
 * Discord 이벤트 핸들러와 EventBus를 통합 관리합니다.
 */

import { onInteraction } from "./onInteraction";
import { onPingPongCreate } from "./onPingPongCreate";
import { onReady } from "./onReady";

// EventBus 재export
export { eventBus, EventBus } from "./bus/EventBus";
export * from "./bus/types";
export * from "./bus/constants";
export { registerAllEventHandlers } from "./bus/utils/registerEventHandlers";

// Discord 이벤트 핸들러 export
export const events = [
  onReady(),
  onPingPongCreate(),
  onInteraction(),
];
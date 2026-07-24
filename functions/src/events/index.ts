/**
 * Events 레이어 통합 진입점
 *
 * Discord 이벤트 핸들러와 EventBus를 통합 관리합니다.
 */

// EventBus 재export
export { eventBus, EventBus } from "./bus/EventBus";
export * from "./bus/types";
export * from "./bus/constants";
export { registerAllEventHandlers } from "./bus/utils/registerEventHandlers";

// Discord 이벤트 핸들러 배열 재노출 (R3 루트 분리 — 실제 정의는 discordListeners.ts).
// 대문 외부 API는 그대로 유지되어 기존 import는 무영향. 단, initDiscordBot은
// registerAllEventHandlers 경로를 피하려고 좁은 모듈(./discordListeners)에서 직접 import한다.
export { events } from "./discordListeners";
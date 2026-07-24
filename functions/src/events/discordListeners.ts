/**
 * Discord 게이트웨이 리스너 배열 — 좁은 모듈 (R3 루트 분리).
 *
 * `events/index.ts`(대문)는 `registerAllEventHandlers`(→ NotificationSendHandler → dmSender)도
 * 재export하므로, `initDiscordBot`이 대문에서 `events`를 가져오면 그 비즈니스 핸들러 경로까지
 * 묻어와 `dmSender ↔ initDiscordBot` 순환이 발생한다.
 *
 * `events` 배열을 이 좁은 모듈로 분리하고 `initDiscordBot`이 여기서 직접 import하면
 * `registerAllEventHandlers` 경로가 사라진다. 이 파일은 onReady/onPingPongCreate/onInteraction만
 * 참조한다(비즈니스 핸들러 미포함).
 */
import { onInteraction } from "./onInteraction";
import { onPingPongCreate } from "./onPingPongCreate";
import { onReady } from "./onReady";

export const events = [
  onReady(),
  onPingPongCreate(),
  onInteraction(),
];

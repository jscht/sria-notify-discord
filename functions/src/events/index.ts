import { onInteraction } from "./onInteraction";
import { onPingPongCreate } from "./onPingPongCreate";
import { onReady } from "./onReady";

export const events = [
  onReady(),
  onPingPongCreate(),
  onInteraction(),
];
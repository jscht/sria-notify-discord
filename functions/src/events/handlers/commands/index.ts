import { recruitCommandHandlers } from "./recruitRequestHandlers";
import { alarmSubscribeCommandHandlers } from "./alarmSubscribeHandlers";

export const commandHandlers = {
  ...recruitCommandHandlers,
  ...alarmSubscribeCommandHandlers,
};
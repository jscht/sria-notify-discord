import type Logger from "../utils/logger";

declare global {
  var DebugLogger: typeof Logger;
}

export {};

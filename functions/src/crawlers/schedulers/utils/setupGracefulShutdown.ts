import { SchedulerManager } from "../SchedulerManager";
import { DebugLogger } from "@/utils/logger";

/**
 * Graceful shutdown 설정
 */
export function setupGracefulShutdown(manager: SchedulerManager): void {
  const stopOnExit = () => {
    DebugLogger.server("🛑 Shutting down schedulers...");
    manager.stopAll();
    process.exit(0);
  };

  process.on("SIGINT", stopOnExit); // Ctrl+C
  process.on("SIGTERM", stopOnExit); // 서버 종료
}

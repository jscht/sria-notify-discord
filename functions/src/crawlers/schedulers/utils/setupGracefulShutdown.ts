import "@/common/utils/logger";
import { SchedulerManager } from "../SchedulerManager";

/**
 * Graceful shutdown 설정
 */
export function setupGracefulShutdown(manager: SchedulerManager): void {
  const stopOnExit = () => {
    globalLogger.info("🛑 Shutting down schedulers...");
    manager.stopAll();
    process.exit(0);
  };

  process.on("SIGINT", stopOnExit); // Ctrl+C
  process.on("SIGTERM", stopOnExit); // 서버 종료
}

import { ScrapScheduler } from "./scrapScheduler";

export class TimeLogScheduler {
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private logIntervalMs: number, private worker: ScrapScheduler) {}

  startLogging(): void {
    if (this.intervalId) {
      DebugLogger.server("TimeLog scheduling is already running.");
      return;
    }

    this.intervalId = setInterval(this.logStatus.bind(this), this.logIntervalMs);
  }

  private logStatus(): void {
    const lastRunTime = this.worker.getLastRunTime();
    const currentTime = new Date();

    if (lastRunTime && lastRunTime.getTime() === this.worker.getLastRunTime()?.getTime()) {
      const timeSinceLastRun = Math.floor((currentTime.getTime() - lastRunTime.getTime()) / 1000);
      const timeUntilNextRun = Math.max(0, Math.floor(this.worker.getWorkIntervalMs() / 1000 - timeSinceLastRun));
      
      const hours = Math.floor(timeUntilNextRun / 3600);  // 시간 계산
      const minutes = Math.floor((timeUntilNextRun % 3600) / 60);  // 분 계산
      const seconds = timeUntilNextRun % 60;

      let timeMessage = "";

      if (hours > 0) {
        timeMessage += `${hours} hour${hours > 1 ? 's' : ''}`;
      }

      if (minutes > 0 || hours > 0) {
        timeMessage += ` ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }

      if (seconds > 0 || (minutes === 0 && hours === 0)) {
        timeMessage += ` ${seconds} second${seconds > 1 ? 's' : ''}`;
      }

      DebugLogger.server(`[TimeLog] Time remaining until the next crawling work: ${timeMessage}.`);
    } else {
      DebugLogger.server("[TimeLog] TimeLog has not run yet.");
    }
  }

  stopLogging(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      DebugLogger.server("TimeLogging scheduler stopped.");
    }
  }
}

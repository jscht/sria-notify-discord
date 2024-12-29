import { CRAWL_MODE } from "../../../constants/crawlMode";
import { crawlService } from "../../../services/crawlService";
import { formatDate } from "../../../utils/formatDate";

export class ScrapScheduler {
  private lastRunTime: Date | null = null;
  private isRunning = false;

  constructor(private workIntervalMs: number) {}

  startWork(mode?: CRAWL_MODE): void {
    if (this.isRunning) {
      DebugLogger.server("Scrap scheduling is already running.");
      return;
    }

    this.isRunning = true;
    this.scheduleNextWork(mode);
  }

  private async scheduleNextWork(mode?: CRAWL_MODE): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();

    this.performWork(mode);

    const elapsedTime = Date.now() - startTime;
    const delay = Math.max(0, this.workIntervalMs - elapsedTime);

    setTimeout(() => this.scheduleNextWork(mode), delay);
  }

  private performWork(mode?: CRAWL_MODE): void {
    this.lastRunTime = new Date();
    DebugLogger.server(`[Scraper] Scraping work at ${formatDate(this.lastRunTime)}`);
    // 실제 작업 로직
    if (!mode) {
      crawlService(CRAWL_MODE.DUMMY);
    } else {
      crawlService(mode);
    }
  }

  stopWork(): void {
    this.isRunning = false;
    DebugLogger.server("Scraping scheduler stopped.");
  }

  getLastRunTime(): Date | null {
    return this.lastRunTime;
  }

  getWorkIntervalMs(): number {
    return this.workIntervalMs;
  }
}

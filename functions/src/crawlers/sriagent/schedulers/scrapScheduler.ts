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

    await this.performWork(mode);

    const elapsedTime = Date.now() - startTime;
    const delay = Math.max(0, this.workIntervalMs - elapsedTime);

    setTimeout(() => this.scheduleNextWork(mode), delay);
  }

  private async performWork(mode?: CRAWL_MODE): Promise<void> {
    try {
      this.lastRunTime = new Date();
      DebugLogger.server(`[Scraper] Scraping work at ${formatDate(this.lastRunTime)}`);
      // Crawling data renewal
      if (!mode) {
        await crawlService(CRAWL_MODE.DUMMY);
      } else {
        await crawlService(mode);
      }
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error during scraping work:", error);
      }
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

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
    this.scheduleNextWork(mode).catch((err) => {
      DebugLogger.error(`[startWork] An error occurred: ${err.message}`);
      this.isRunning = false;
    });
  }

  private async scheduleNextWork(mode?: CRAWL_MODE): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();

    await this.performWork(mode).catch((err) => {
      this.isRunning = false;
      throw err;
    });

    const elapsedTime = Date.now() - startTime;
    const delay = Math.max(0, this.workIntervalMs - elapsedTime);

    setTimeout(() => {
      if (!this.isRunning) return;
      this.scheduleNextWork(mode).catch((err) => {
        this.isRunning = false;
        throw err;
      });
    }, delay);
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
      throw error;
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

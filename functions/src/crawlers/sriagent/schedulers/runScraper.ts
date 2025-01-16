import { CRAWL_MODE } from "../../../constants/crawlMode";
import { ScrapScheduler } from "./scrapScheduler";
import { TimeLogScheduler } from "./timeLogScheduler";

export async function runScraper() {
  // const workIntervalMs = 4 * 60 * 60 * 1000; // 4시간 (4시간 * 60분 * 60초 * 1000ms)
  // const logIntervalMs = 1 * 60 * 60 * 1000; // 1시간 (1시간 * 60분 * 60초 * 1000ms)

  const workIntervalMs = 2 * 60 * 1000; // 2분
  const logIntervalMs = 30 * 1000; // 30초

  const scraperManager = (() => {
    let scraper: ScrapScheduler | null = null;
    let timeLogger: TimeLogScheduler | null = null;

    return {
      start: (mode: CRAWL_MODE) => {
        scraper = new ScrapScheduler(workIntervalMs);
        timeLogger = new TimeLogScheduler(logIntervalMs, scraper);

        scraper.startWork(mode);
        timeLogger.startLogging();

        DebugLogger.server("Scraper started.");
      },
      stop: () => {
        scraper?.stopWork();
        timeLogger?.stopLogging();

        scraper = null;
        timeLogger = null;

        DebugLogger.server("Scraper stopped.");
      },
      isRunning: () => scraper !== null && timeLogger !== null,
    };
  })();

  if (scraperManager.isRunning()) {
    DebugLogger.server("Scraper is already running. Skipping duplicate request.");
    return;
  }

  scraperManager.start(CRAWL_MODE.DUMMY);

  const stopSchedulerOnExit = () => {
    scraperManager.stop();
    process.exit();
  };

  process.on("SIGINT", stopSchedulerOnExit); // Ctrl+C
  process.on("SIGTERM", stopSchedulerOnExit); // 서버 종료 시그널
}

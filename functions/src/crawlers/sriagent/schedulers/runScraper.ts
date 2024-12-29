import { ScrapScheduler } from "./scrapScheduler";
import { TimeLogScheduler } from "./timeLogScheduler";

export function runScraper() {
  const workIntervalMs = 4 * 60 * 60 * 1000; // 4시간 (4시간 * 60분 * 60초 * 1000ms)
  const logIntervalMs = 1 * 60 * 60 * 1000; // 1시간 (1시간 * 60분 * 60초 * 1000ms)

  const scraper = new ScrapScheduler(workIntervalMs);
  const timeLogger = new TimeLogScheduler(logIntervalMs, scraper);

  scraper.startWork();
  timeLogger.startLogging();

  const stopSchedulerOnExit = () => {
    scraper.stopWork();
    timeLogger.stopLogging();
    process.exit();
  };

  process.on('SIGINT', stopSchedulerOnExit);  // Ctrl+C
  process.on('SIGTERM', stopSchedulerOnExit); // 서버 종료 시그널
};

import "@/common/utils/systemLogger";
import { BaseScheduler } from "./base/BaseScheduler";
import { ProxyCrawler } from "@/crawlers/strategies";
import type { SchedulerConfig, WorkResult } from "./types";

/**
 * 프록시 크롤링 스케줄러
 * 하루 4번 (6시간 간격) 프록시 목록 갱신
 */
export class ProxyScheduler extends BaseScheduler {
  private proxyCrawler: ProxyCrawler;

  constructor(workIntervalMs: number = 6 * 60 * 60 * 1000) { // 6시간
    const config: SchedulerConfig = {
      name: "ProxyScheduler",
      workIntervalMs,
      logIntervalMs: 60 * 1000,
    };

    super(config);
    this.proxyCrawler = new ProxyCrawler();
  }

  /**
   * 프록시 크롤링 작업
   */
  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();

    try {
      globalLogger.info(`[${this.config.name}] 🔍 Proxy crawling started...`);

      const proxyData = await this.proxyCrawler.crawl();

      // TODO: Redis나 Firestore에 프록시 목록 저장
      // await this.saveProxyList(proxyData);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const message = `Collected ${proxyData?.length || 0} proxies`;

      globalLogger.info(`[${this.config.name}] ✅ ${message}`);

      return {
        success: true,
        startTime,
        endTime,
        durationMs,
        message,
      };
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      throw {
        success: false,
        startTime,
        endTime,
        durationMs,
        error: error as Error,
        message: `Proxy crawling failed: ${(error as Error).message}`,
      };
    }
  }
}

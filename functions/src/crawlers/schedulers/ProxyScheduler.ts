import "@/common/utils/systemLogger";
import { BaseScheduler } from "./base/BaseScheduler";
import { ProxyCrawler } from "@/crawlers/strategies";
import { filterVerifiedProxies } from "@/crawlers/utils";
import { ProxyStore } from "@/providers/firebase/store";
import { SystemError } from "@/common/utils/systemError";
import { emitSystemErrorEvent } from "@/common/utils/errorHandler";
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

      // Phase 1.10: 저장 전 재검증(elite·HTTPS/SOCKS·liveness) — 통과분만 저장.
      const verified = await filterVerifiedProxies(proxyData);

      if (verified.length === 0) {
        const err = SystemError.critical(
          "ProxyScheduler: 검증 통과 프록시 0건 — 프록시 풀 고갈",
          undefined,
          { collected: proxyData.length }
        );
        emitSystemErrorEvent(err); // → SYSTEM_ERROR_CRITICAL
        throw err;
      }

      await new ProxyStore().saveProxyList(verified);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const message = `Collected ${proxyData.length}, verified & saved ${verified.length} proxies`;

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

      // 수집 자체 실패도 CRITICAL로 발행 (verify-empty는 이미 발행됨 — 중복 방지).
      if (!(error instanceof SystemError)) {
        emitSystemErrorEvent(
          SystemError.critical("ProxyScheduler: 프록시 수집 실패", error as Error)
        );
      }

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

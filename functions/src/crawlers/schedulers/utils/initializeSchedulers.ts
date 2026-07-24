import "@/common/utils/systemLogger";
import { SchedulerManager } from "../SchedulerManager";
import { CRAWL_MODE } from "@/common/constants";

/**
 * 스케줄러 초기화 설정
 */
export interface SchedulerInitConfig {
  recruitInterval?: number;
  recruitMode?: CRAWL_MODE;
  proxyInterval?: number;
  /**
   * Proxy 스케줄러 시작 여부 (기본 true, 하위호환).
   * false면 Recruit만 시작 — Phase 1.9 로컬 E2E는 false(Proxy 활성화는 Phase 1.10).
   */
  enableProxy?: boolean;
}

/**
 * 모든 스케줄러 초기화
 */
export function initializeSchedulers(
  config?: SchedulerInitConfig
): SchedulerManager {
  const manager = SchedulerManager.getInstance();

  // Recruit 스케줄러 시작 (기본 4시간)
  manager.startRecruitScheduler(
    config?.recruitInterval || 4 * 60 * 60 * 1000,
    config?.recruitMode || CRAWL_MODE.DUMMY
  );

  // Proxy 스케줄러 시작 (기본 6시간, 하루 4번). enableProxy:false면 게이팅(→ Phase 1.10).
  if (config?.enableProxy ?? true) {
    manager.startProxyScheduler(
      config?.proxyInterval || 6 * 60 * 60 * 1000
    );
  } else {
    globalLogger.info("⏭️ Proxy scheduler skipped (enableProxy=false)");
  }

  globalLogger.info("✅ All schedulers initialized");

  return manager;
}

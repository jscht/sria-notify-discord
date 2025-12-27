import { SchedulerManager } from "../SchedulerManager";
import { CRAWL_MODE } from "@/common/constants";
import { DebugLogger } from "@/utils/logger";

/**
 * 스케줄러 초기화 설정
 */
export interface SchedulerInitConfig {
  recruitInterval?: number;
  recruitMode?: CRAWL_MODE;
}

/**
 * 모든 스케줄러 초기화
 */
export function initializeSchedulers(
  config?: SchedulerInitConfig
): SchedulerManager {
  const manager = SchedulerManager.getInstance();

  // Recruit 스케줄러 시작
  manager.startRecruitScheduler(
    config?.recruitInterval || 4 * 60 * 60 * 1000, // 기본 4시간
    config?.recruitMode || CRAWL_MODE.DUMMY
  );

  DebugLogger.server("✅ All schedulers initialized");

  return manager;
}

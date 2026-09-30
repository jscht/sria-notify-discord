import "@/common/utils/systemLogger";
import { SchedulerManager } from "../SchedulerManager";
import type { RecruitSource } from "@/common/types";

/**
 * 스케줄러 초기화 설정
 */
export interface SchedulerInitConfig {
  recruitInterval?: number;
}

/** 상시 루프로 기동할 소스 목록. */
const RECRUIT_SOURCES: RecruitSource[] = ["sria", "temp"];

/**
 * 모든 스케줄러 초기화. (Phase 1.10 재정의 — 소스별 Recruit 스케줄러)
 * ※ 상시 루프(로컬/대안) 경로. 프로덕션은 app/scheduler.ts의 소스별 onSchedule 사용.
 */
export function initializeSchedulers(
  config?: SchedulerInitConfig
): SchedulerManager {
  const manager = SchedulerManager.getInstance();

  // 소스별 Recruit 스케줄러 시작 (기본 4시간)
  for (const source of RECRUIT_SOURCES) {
    manager.startRecruitScheduler(source, config?.recruitInterval || 4 * 60 * 60 * 1000);
  }

  globalLogger.info("✅ All schedulers initialized");

  return manager;
}

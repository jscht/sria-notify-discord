import "@/common/utils/systemLogger";
import { SchedulerManager } from "../SchedulerManager";
import { createRecruitScheduler } from "../factory";
import type { RecruitSource } from "@/common/types";

/** 상시 루프로 기동할 소스 목록. */
const RECRUIT_SOURCES: RecruitSource[] = ["sria", "temp"];

/**
 * 모든 스케줄러 초기화. (scheduler Factory refactor — 팩토리 생성 후 매니저 주입)
 * ※ 상시 루프(로컬/대안) 경로. 프로덕션은 app/scheduler.ts의 소스별 onSchedule 사용.
 * 주기는 각 소스 config의 intervalMinutes에서 파생되므로 여기서 주입하지 않는다.
 */
export function initializeSchedulers(): SchedulerManager {
  const manager = new SchedulerManager();

  for (const source of RECRUIT_SOURCES) {
    manager.register(source, createRecruitScheduler(source));
    manager.start(source);
  }

  globalLogger.info("✅ All schedulers initialized");

  return manager;
}

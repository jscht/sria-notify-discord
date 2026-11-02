import "@/common/utils/systemLogger";
import { SchedulerManager } from "../SchedulerManager";
import { createScheduler } from "../factory";
import { SCHEDULED_JOBS } from "../jobs";

/**
 * 작업 목록(`SCHEDULED_JOBS`)을 돌며 스케줄러를 등록한다. 시작하지는 않는다.
 *
 * @returns 등록을 마친 매니저. 레지스트리 키는 작업의 `functionName`이다
 */
export function registerSchedulers(): SchedulerManager {
  const manager = new SchedulerManager();

  for (const job of SCHEDULED_JOBS) {
    manager.register(job.functionName, createScheduler(job));
  }

  return manager;
}

/**
 * 모든 스케줄러를 등록하고 시작한다. (상시 루프 — 로컬/대안 경로)
 *
 * ※ 프로덕션은 app/scheduler.ts의 onSchedule을 사용한다.
 * 이 경로는 cron 일정을 읽지 않고 `intervalMinutes`로만 돌며 시작 즉시 한 번 실행하므로,
 * 알림의 22~04시 미발송을 지키지 않는다.
 */
export function initializeSchedulers(): SchedulerManager {
  const manager = registerSchedulers();
  manager.startAll();

  globalLogger.info("✅ All schedulers initialized");

  return manager;
}

import { RecruitScheduler } from "./RecruitScheduler";
import { toIntervalMs } from "./utils/interval";
import type { ScheduledJob } from "./jobs";

/**
 * 예약 작업 스케줄러 팩토리.
 *
 * 싱글턴 대신 호출 시마다 새 인스턴스를 생성해 반환한다.
 * 스케줄러 이름은 `job.functionName`을 쓰고, 주기는 `job.intervalMinutes` 하나에서 파생한다.
 *
 * @param job 예약 실행할 작업
 * @returns 이 작업을 실행하는 스케줄러
 */
export function createScheduler(job: ScheduledJob): RecruitScheduler {
  return new RecruitScheduler(job.functionName, toIntervalMs(job.intervalMinutes), job.run);
}

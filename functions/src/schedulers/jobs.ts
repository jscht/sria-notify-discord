import type { RecruitSource } from "@/common/types";
import { getSourceConfig } from "@/providers/recruit";
import {
  getNotificationService,
  NOTIFICATION_INTERVAL_MINUTES,
  NOTIFICATION_SCHEDULE,
} from "@/services/notificationService";
import { RecruitService } from "@/services/recruitService";

/** 예약 실행할 작업 하나. 운영 함수·로컬 1회 실행·로컬 계속 실행이 모두 이 값을 읽는다. */
export interface ScheduledJob {
  /** 배포되는 함수 이름. 바꾸면 기존 예약 실행 함수가 지워지고 새로 만들어진다 */
  functionName: string;
  /** 로컬 계속 실행의 반복 주기. `schedule`이 없으면 운영 일정도 이 값으로 만든다 */
  intervalMinutes: number;
  /** 운영 일정을 직접 적을 때 쓴다 (cron 표현) */
  schedule?: string;
  timeoutSeconds: number;
  /** 작업 실행. 처리 건수를 돌려주며 이 값이 `RECRUIT_SYNC_COMPLETED`의 `totalCount`가 된다 */
  run: () => Promise<number>;
}

const syncSource = (source: RecruitSource) => async () => {
  const { addedJobs, updatedJobs } = await new RecruitService().syncRecruits(source);
  return addedJobs.length + updatedJobs.length;
};

/**
 * 예약 실행할 작업 목록. 작업은 여기에만 적는다.
 *
 * `run`은 실행될 때만 불리므로 파일을 불러오거나 스케줄러를 등록하는 단계에서는
 * Redis를 건드리지 않는다.
 */
export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    functionName: "recruitSchedule_sria",
    intervalMinutes: getSourceConfig("sria").intervalMinutes,
    timeoutSeconds: 120,
    run: syncSource("sria"),
  },
  {
    functionName: "recruitSchedule_elias",
    intervalMinutes: getSourceConfig("elias").intervalMinutes,
    timeoutSeconds: 120,
    run: syncSource("elias"),
  },
  {
    functionName: "notificationScheduler",
    intervalMinutes: NOTIFICATION_INTERVAL_MINUTES,
    schedule: NOTIFICATION_SCHEDULE,
    timeoutSeconds: 300,
    run: () => getNotificationService().runNotification(),
  },
];

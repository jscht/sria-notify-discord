import "dotenv/config";
/**
 * 작업 목록과 내보낸 함수 테스트 (design §6.1 #9, §2.8.2)
 *
 * 빌드한 `lib/app/scheduler.js`를 불러와 내보낸 이름과 일정을 읽는다. 함수를 실행하지 않는다.
 */

import { expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";

const EXPECTED_NAMES = ["notificationScheduler", "recruitSchedule_elias", "recruitSchedule_sria"];

interface ScheduleEndpoint {
  timeoutSeconds?: number;
  scheduleTrigger: { schedule: string; timeZone: string };
}

type ExportedFunctions = Record<string, { __endpoint: ScheduleEndpoint }>;

export async function testScheduledJobs(): Promise<boolean> {
  // .env에 RUN_SCHEDULER_ONCE=true가 있어도 불러오는 순간 작업이 실행되지 않게 막는다.
  // dotenv는 이미 있는 값을 덮어쓰지 않는다.
  process.env.RUN_SCHEDULER_ONCE = "false";

  // 위 값을 먼저 정해야 하므로 실행 중에 불러온다. 순서도 app/scheduler.ts를 먼저 한다.
  const exported = (await import("../scheduler")) as unknown as ExportedFunctions;
  const { registerSchedulers, SCHEDULED_JOBS, toScheduleExpression } =
    await import("../../schedulers");

  const jobNames = SCHEDULED_JOBS.map(({ functionName }) => functionName).sort();

  return runCases("작업 목록과 내보낸 함수", [
    {
      name: "작업 목록의 이름이 세 함수와 같음",
      run: () => {
        expectEqual(jobNames, EXPECTED_NAMES);
      },
    },
    {
      name: "내보낸 이름이 작업 목록과 같음",
      run: () => {
        expectEqual(Object.keys(exported).sort(), jobNames);
      },
    },
    {
      name: "레지스트리 키가 작업 목록과 같고 시작되지 않음",
      run: () => {
        const status = registerSchedulers().getAllStatus();
        expectEqual(Object.keys(status).sort(), jobNames);
        expectTrue(
          Object.values(status).every(({ isRunning }) => !isRunning),
          "스케줄러가 시작됨"
        );
      },
    },
    {
      name: "각 함수의 일정·시간대·제한 시간이 목록 값과 같음",
      run: () => {
        for (const job of SCHEDULED_JOBS) {
          const endpoint = exported[job.functionName].__endpoint;
          expectEqual(
            endpoint.scheduleTrigger.schedule,
            job.schedule ?? toScheduleExpression(job.intervalMinutes),
            `${job.functionName} 일정`
          );
          expectEqual(endpoint.scheduleTrigger.timeZone, "Asia/Seoul");
          expectEqual(endpoint.timeoutSeconds, job.timeoutSeconds, `${job.functionName} 제한 시간`);
        }
      },
    },
    {
      name: "알림 일정이 0 6-20/2 * * *",
      run: () => {
        const { scheduleTrigger } = exported.notificationScheduler.__endpoint;
        expectEqual(scheduleTrigger.schedule, "0 6-20/2 * * *");
        expectEqual(scheduleTrigger.timeZone, "Asia/Seoul");
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testScheduledJobs());
}

import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initFunctionProviders } from "@/providers";
import { registerAllEventHandlers } from "@/events";
import { createScheduler, SCHEDULED_JOBS, toScheduleExpression } from "@/schedulers";

// 최후의 거름망(A): init 중 발생하는 미처리 rejection/예외도 잡도록 가장 먼저 등록한다.
registerGlobalErrorHandlers();

// 비밀값(토큰·키·비밀번호)은 .env가 아니라 Google Cloud Secret Manager에 저장하고,
// 아래 목록에 이름을 적어야 배포된 함수가 실행될 때 process.env로 받을 수 있다.
// 목록에서 빠지면 배포 환경에서 값이 undefined가 되어 Firebase 인증과 DM 전송이 실패한다.
// 값 저장: firebase functions:secrets:set <이름>
// REDIS_URL은 접속 주소 안에 비밀번호가 들어 있어(rediss://user:pw@host) 비밀값으로 취급한다.
// 로컬 실행(RUN_SCHEDULER_ONCE)은 .env를 그대로 읽으므로 이 설정과 무관하다.
const FUNCTION_SECRETS = ["FB_PRIVATE_KEY", "DISCORD_BOT_TOKEN", "REDIS_URL"];

// 함수 프로세스 부트스트랩: REST 전용 provider init 후 EventBus 핸들러 등록.
// 처음 부를 때 시작한다. 파일을 불러오는 것만으로 Firebase·Redis 연결이 시작되지 않아,
// 내보낸 함수 이름을 테스트로 확인할 수 있다.
let readyPromise: Promise<void> | undefined;
const ready = () =>
  (readyPromise ??= initFunctionProviders().then(() => registerAllEventHandlers()));

/**
 * 프로덕션 예약 트리거 — 작업 목록(`SCHEDULED_JOBS`)의 작업마다 함수 하나를 내보낸다.
 * 일정은 배포 시점에 확정되므로 바꾸면 다시 배포한다.
 * `runOnce()`는 예외를 삼키고 `RECRUIT_SYNC_*` 이벤트를 발행한다.
 */
for (const job of SCHEDULED_JOBS) {
  exports[job.functionName] = onSchedule(
    {
      schedule: job.schedule ?? toScheduleExpression(job.intervalMinutes),
      timeZone: "Asia/Seoul",
      timeoutSeconds: job.timeoutSeconds,
      secrets: FUNCTION_SECRETS,
    },
    async () => {
      await ready();
      await createScheduler(job).runOnce();
    }
  );
}

// 로컬 E2E — env 게이팅. 실행: RUN_SCHEDULER_ONCE=true (목록 순서대로 1회씩, 사이트 갱신 뒤 알림)
if (process.env.RUN_SCHEDULER_ONCE === "true") {
  ready()
    .then(async () => {
      for (const job of SCHEDULED_JOBS) {
        await createScheduler(job).runOnce();
      }
    })
    .catch((e) => globalLogger.error("로컬 스케줄러 1회 실행 실패:", e));
}

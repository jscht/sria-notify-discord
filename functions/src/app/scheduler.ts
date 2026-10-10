import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initFunctionProviders } from "@/providers";
import { registerAllEventHandlers } from "@/events";
import { createRecruitScheduler, toScheduleExpression } from "@/schedulers";
import { getSourceConfig } from "@/providers/recruit";

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
// 메모이즈된 ready promise를 각 트리거가 await한다.
const ready = initFunctionProviders().then(() => registerAllEventHandlers());

/**
 * 프로덕션 공고 갱신 트리거 — **사이트별** (소스 프로바이더 수집→소스별 diff→DM).
 * 각 사이트 config의 schedule을 주기로 사용(배포 시점 확정 → 변경 시 redeploy).
 */
// eslint-disable-next-line camelcase -- 배포되는 Firebase Function 이름(함수 ID). 리네임 시 스케줄 함수가 교체됨.
export const recruitSchedule_sria = onSchedule(
  {
    schedule: toScheduleExpression(getSourceConfig("sria").intervalMinutes),
    secrets: FUNCTION_SECRETS,
  },
  async () => {
    await ready;
    await createRecruitScheduler("sria").runOnce();
  }
);

// eslint-disable-next-line camelcase -- 배포되는 Firebase Function 이름(함수 ID). 리네임 시 스케줄 함수가 교체됨.
export const recruitSchedule_temp = onSchedule(
  {
    schedule: toScheduleExpression(getSourceConfig("temp").intervalMinutes),
    secrets: FUNCTION_SECRETS,
  },
  async () => {
    await ready;
    await createRecruitScheduler("temp").runOnce();
  }
);

// 로컬 E2E — env 게이팅. 실행: RUN_SCHEDULER_ONCE=true (양 소스 1회씩)
if (process.env.RUN_SCHEDULER_ONCE === "true") {
  ready
    .then(async () => {
      await createRecruitScheduler("sria").runOnce();
      await createRecruitScheduler("temp").runOnce();
    })
    .catch((e) => globalLogger.error("로컬 스케줄러 1회 실행 실패:", e));
}

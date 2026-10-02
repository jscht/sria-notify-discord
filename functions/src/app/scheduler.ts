import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initFunctionProviders } from "@/providers";
import { registerAllEventHandlers } from "@/events";
import { SchedulerManager } from "@/schedulers";
import { sriaConfig, tempConfig } from "@/providers/recruit";

// 최후의 거름망(A): init 중 발생하는 미처리 rejection/예외도 잡도록 가장 먼저 등록한다.
registerGlobalErrorHandlers();

// 함수 프로세스 부트스트랩: REST 전용 provider init 후 EventBus 핸들러 등록.
// 메모이즈된 ready promise를 각 트리거가 await한다.
const ready = initFunctionProviders().then(() => registerAllEventHandlers());

/**
 * 프로덕션 공고 갱신 트리거 — **사이트별** (소스 프로바이더 수집→소스별 diff→DM).
 * 각 사이트 config의 schedule을 주기로 사용(배포 시점 확정 → 변경 시 redeploy).
 */
// eslint-disable-next-line camelcase -- 배포되는 Firebase Function 이름(함수 ID). 리네임 시 스케줄 함수가 교체됨.
export const recruitSchedule_sria = onSchedule(sriaConfig.schedule, async () => {
  await ready;
  await SchedulerManager.getInstance().runRecruitOnce("sria");
});

// eslint-disable-next-line camelcase -- 배포되는 Firebase Function 이름(함수 ID). 리네임 시 스케줄 함수가 교체됨.
export const recruitSchedule_temp = onSchedule(tempConfig.schedule, async () => {
  await ready;
  await SchedulerManager.getInstance().runRecruitOnce("temp");
});

// 로컬 E2E — env 게이팅. 실행: RUN_SCHEDULER_ONCE=true (양 소스 1회씩)
if (process.env.RUN_SCHEDULER_ONCE === "true") {
  ready
    .then(async () => {
      const manager = SchedulerManager.getInstance();
      await manager.runRecruitOnce("sria");
      await manager.runRecruitOnce("temp");
    })
    .catch((e) => globalLogger.error("로컬 스케줄러 1회 실행 실패:", e));
}

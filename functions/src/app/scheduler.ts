import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initFunctionProviders } from "@/providers";
import { registerAllEventHandlers } from "@/events";
import { SchedulerManager } from "@/crawlers";
import { CRAWL_MODE } from "@/common/constants";

// 최후의 거름망(A): init 중 발생하는 미처리 rejection/예외도 잡도록 가장 먼저 등록한다.
registerGlobalErrorHandlers();

// 함수 프로세스 부트스트랩: REST 전용 provider init 후 EventBus 핸들러 등록.
// 메모이즈된 ready promise를 각 트리거가 await한다.
const ready = initFunctionProviders().then(() => registerAllEventHandlers());

/** 프로덕션 크롤 트리거 (코드만 — 실발화·실 CRAWL·실배포는 Phase 1.10). */
export const recruitSchedule = onSchedule("every 4 hours", async () => {
  await ready;
  await SchedulerManager.getInstance().runRecruitOnce(CRAWL_MODE.CRAWL);
});

// 로컬 DUMMY E2E (1.9 auto-E2E 대체) — env 게이팅. 실행: RUN_SCHEDULER_ONCE=true
if (process.env.RUN_SCHEDULER_ONCE === "true") {
  ready
    .then(() => SchedulerManager.getInstance().runRecruitOnce(CRAWL_MODE.DUMMY))
    .catch((e) => globalLogger.error("로컬 스케줄러 1회 실행 실패:", e));
}

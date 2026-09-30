import { registerGlobalErrorHandlers } from "./registerGlobalErrorHandlers";
import { initGatewayProviders } from "@/providers";
import { registerAllEventHandlers } from "@/events";

/**
 * 게이트웨이 프로세스 공통 부트스트랩 (E안).
 *
 * 두 엔트리가 공유한다:
 * - `app/gateway.ts`  — Oracle Cloud VM + pm2 상시 호스트 (`node lib/app/gateway.js`)
 * - `app/index.ts`    — (레거시) Functions onRequest 래핑. main 전환 이후 배포되지 않음.
 *
 * 동작:
 * 1) 전역 에러 핸들러 등록(최후의 거름망) — init 중 미처리 예외까지 커버하도록 가장 먼저.
 * 2) gateway providers init(Firebase + Redis + Discord WS login) 완료 후 EventBus 핸들러 등록.
 *
 * gateway 프로세스는 **인터랙션(슬래시 커맨드·버튼 등) 수신 전용**이며 스케줄러를 시작하지
 * 않는다. 크롤·알림 tick은 스케줄러 프로세스(`app/scheduler.ts` onSchedule, Functions)가
 * 담당한다. `initGatewayProviders()`는 메모이즈되어 중복 호출돼도 같은 promise를 반환한다.
 */
export function bootstrapGateway(): void {
  registerGlobalErrorHandlers();

  initGatewayProviders()
    .then(() => {
      registerAllEventHandlers();
    })
    .catch((error) => {
      globalLogger.error("Eager gateway provider initialization failed:", error);
    });
}

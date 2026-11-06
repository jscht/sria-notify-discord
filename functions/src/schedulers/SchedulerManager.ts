import "@/common/utils/systemLogger";
import type { SchedulerStatus } from "./types";
import type { BaseScheduler } from "./base/BaseScheduler";

/**
 * 예약 작업 스케줄러 레지스트리 — 상시 루프(로컬/대안) 경로의 생명주기 관리.
 * 레지스트리 키는 작업의 `functionName`이다.
 *
 * 싱글턴 아님: 컴포지션 루트(registerSchedulers)에서 `new` 후 팩토리 산출물을 주입한다.
 * 서버리스 onSchedule은 매니저 없이 `createScheduler(job).runOnce()`를 직접 호출.
 */
export class SchedulerManager {
  private readonly schedulers = new Map<string, BaseScheduler>();

  /** 스케줄러 등록(주입). 같은 이름은 덮어쓴다. */
  register(functionName: string, scheduler: BaseScheduler): void {
    this.schedulers.set(functionName, scheduler);
  }

  /** 등록된 스케줄러의 재스케줄 루프 시작. */
  start(functionName: string): void {
    this.schedulers.get(functionName)?.startWork();
  }

  /** 등록된 모든 스케줄러 시작. */
  startAll(): void {
    this.schedulers.forEach((scheduler) => scheduler.startWork());
  }

  /** 스케줄러 정지. */
  stop(functionName: string): void {
    this.schedulers.get(functionName)?.stopWork();
  }

  /** 모든 스케줄러 정지. */
  stopAll(): void {
    this.schedulers.forEach((scheduler) => scheduler.stopWork());
    globalLogger.info("All schedulers stopped.");
  }

  /** 스케줄러 상태 조회. */
  getStatus(functionName: string): SchedulerStatus | null {
    return this.schedulers.get(functionName)?.getStatus() ?? null;
  }

  /** 모든 스케줄러 상태 조회 (레지스트리 키 기준). */
  getAllStatus(): Record<string, SchedulerStatus> {
    const status: Record<string, SchedulerStatus> = {};
    this.schedulers.forEach((scheduler, name) => {
      status[name] = scheduler.getStatus();
    });
    return status;
  }
}

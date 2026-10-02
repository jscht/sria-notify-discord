import "@/common/utils/systemLogger";
import type { SchedulerStatus } from "./types";
import type { BaseScheduler } from "./base/BaseScheduler";
import type { RecruitSource } from "@/common/types";

/**
 * 소스별 스케줄러 레지스트리 — 상시 루프(로컬/대안) 경로의 생명주기 관리.
 *
 * 싱글턴 아님: 컴포지션 루트(initializeSchedulers)에서 `new` 후 팩토리 산출물을 주입한다.
 * 서버리스 onSchedule은 매니저 없이 `createRecruitScheduler(source).runOnce()`를 직접 호출.
 */
export class SchedulerManager {
  private readonly schedulers = new Map<string, BaseScheduler>();

  private key(source: RecruitSource): string {
    return `recruit:${source}`;
  }

  /** 소스별 스케줄러 등록(주입). 같은 소스는 덮어쓴다. */
  register(source: RecruitSource, scheduler: BaseScheduler): void {
    this.schedulers.set(this.key(source), scheduler);
  }

  /** 등록된 소스 스케줄러의 재스케줄 루프 시작. */
  start(source: RecruitSource): void {
    this.schedulers.get(this.key(source))?.startWork();
  }

  /** 등록된 모든 스케줄러 시작. */
  startAll(): void {
    this.schedulers.forEach((scheduler) => scheduler.startWork());
  }

  /** 소스별 스케줄러 정지. */
  stop(source: RecruitSource): void {
    this.schedulers.get(this.key(source))?.stopWork();
  }

  /** 모든 스케줄러 정지. */
  stopAll(): void {
    this.schedulers.forEach((scheduler) => scheduler.stopWork());
    globalLogger.info("All schedulers stopped.");
  }

  /** 소스별 스케줄러 상태 조회. */
  getStatus(source: RecruitSource): SchedulerStatus | null {
    return this.schedulers.get(this.key(source))?.getStatus() ?? null;
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

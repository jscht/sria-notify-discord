import "@/common/utils/systemLogger";
import { RecruitScheduler } from "./RecruitScheduler";
import { ProxyScheduler } from "./ProxyScheduler";
import { CRAWL_MODE } from "@/common/constants";
import type { SchedulerStatus } from "./types";
import { BaseScheduler } from "./base/BaseScheduler";

/**
 * 모든 스케줄러를 중앙에서 관리 (Singleton)
 */
export class SchedulerManager {
  private static instance: SchedulerManager;
  private schedulers: Map<string, BaseScheduler> = new Map();

  private constructor() {}

  /**
   * Singleton 인스턴스 획득
   */
  static getInstance(): SchedulerManager {
    if (!SchedulerManager.instance) {
      SchedulerManager.instance = new SchedulerManager();
    }
    return SchedulerManager.instance;
  }

  /**
   * Recruit 스케줄러 시작
   */
  startRecruitScheduler(
    workIntervalMs?: number,
    mode: CRAWL_MODE = CRAWL_MODE.DUMMY
  ): void {
    let scheduler = this.schedulers.get("recruit") as RecruitScheduler;

    if (!scheduler) {
      scheduler = new RecruitScheduler(workIntervalMs, mode);
      this.schedulers.set("recruit", scheduler);
    }

    scheduler.startWork();
  }

  /**
   * Recruit 스케줄러 정지
   */
  stopRecruitScheduler(): void {
    const scheduler = this.schedulers.get("recruit");
    if (scheduler) {
      scheduler.stopWork();
    }
  }

  /**
   * Proxy 스케줄러 시작
   */
  startProxyScheduler(workIntervalMs?: number): void {
    let scheduler = this.schedulers.get("proxy") as ProxyScheduler;

    if (!scheduler) {
      scheduler = new ProxyScheduler(workIntervalMs);
      this.schedulers.set("proxy", scheduler);
    }

    scheduler.startWork();
  }

  /**
   * Proxy 스케줄러 정지
   */
  stopProxyScheduler(): void {
    const scheduler = this.schedulers.get("proxy");
    if (scheduler) {
      scheduler.stopWork();
    }
  }

  /**
   * 모든 스케줄러 정지
   */
  stopAll(): void {
    this.schedulers.forEach((scheduler) => {
      scheduler.stopWork();
    });

    globalLogger.info("All schedulers stopped.");
  }

  /**
   * 특정 스케줄러 상태 조회
   */
  getStatus(name: string): SchedulerStatus | null {
    const scheduler = this.schedulers.get(name);
    return scheduler ? scheduler.getStatus() : null;
  }

  /**
   * 모든 스케줄러 상태 조회
   */
  getAllStatus(): Record<string, SchedulerStatus> {
    const status: Record<string, SchedulerStatus> = {};

    this.schedulers.forEach((scheduler, name) => {
      status[name] = scheduler.getStatus();
    });

    return status;
  }
}

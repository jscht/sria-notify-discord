import "@/common/utils/systemLogger";
import { RecruitScheduler } from "./RecruitScheduler";
import type { SchedulerStatus, WorkResult } from "./types";
import { BaseScheduler } from "./base/BaseScheduler";
import type { RecruitSource } from "@/common/types";

/**
 * 모든 스케줄러를 중앙에서 관리 (Singleton).
 * Phase 1.10 재정의: 공고 수집은 **소스별** 스케줄러(사이트마다 하나)로 관리한다.
 */
export class SchedulerManager {
  private static instance: SchedulerManager;
  private schedulers: Map<string, BaseScheduler> = new Map();

  private constructor() {}

  static getInstance(): SchedulerManager {
    if (!SchedulerManager.instance) {
      SchedulerManager.instance = new SchedulerManager();
    }
    return SchedulerManager.instance;
  }

  private key(source: RecruitSource): string {
    return `recruit:${source}`;
  }

  private getOrCreate(source: RecruitSource, workIntervalMs?: number): RecruitScheduler {
    const key = this.key(source);
    let scheduler = this.schedulers.get(key) as RecruitScheduler | undefined;
    if (!scheduler) {
      scheduler = new RecruitScheduler(source, workIntervalMs);
      this.schedulers.set(key, scheduler);
    }
    return scheduler;
  }

  /** 소스별 Recruit 스케줄러 시작 (재스케줄 루프). */
  startRecruitScheduler(source: RecruitSource, workIntervalMs?: number): void {
    this.getOrCreate(source, workIntervalMs).startWork();
  }

  /**
   * 소스별 Recruit 스케줄러 단일 tick 실행 (서버리스 onSchedule 전용).
   * 재스케줄 루프 없이 runOnce()만 1회 실행.
   */
  async runRecruitOnce(source: RecruitSource): Promise<WorkResult> {
    return this.getOrCreate(source).runOnce();
  }

  /** 소스별 Recruit 스케줄러 정지 */
  stopRecruitScheduler(source: RecruitSource): void {
    this.schedulers.get(this.key(source))?.stopWork();
  }

  /** 모든 스케줄러 정지 */
  stopAll(): void {
    this.schedulers.forEach((scheduler) => scheduler.stopWork());
    globalLogger.info("All schedulers stopped.");
  }

  /** 특정 스케줄러 상태 조회 */
  getStatus(name: string): SchedulerStatus | null {
    const scheduler = this.schedulers.get(name);
    return scheduler ? scheduler.getStatus() : null;
  }

  /** 모든 스케줄러 상태 조회 */
  getAllStatus(): Record<string, SchedulerStatus> {
    const status: Record<string, SchedulerStatus> = {};
    this.schedulers.forEach((scheduler, name) => {
      status[name] = scheduler.getStatus();
    });
    return status;
  }
}

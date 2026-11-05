import { BaseScheduler } from "./base/BaseScheduler";
import type { SchedulerConfig, WorkResult } from "./types";

/**
 * 받은 `run`을 주기마다 실행하는 범용 스케줄러.
 * 공고 동기화와 알림이 같은 클래스를 쓴다. 어느 작업인지는 스케줄러 이름으로 구분한다.
 */
export class RecruitScheduler extends BaseScheduler {
  private readonly run: () => Promise<number>;

  // workIntervalMs는 필수 — 작업 목록(SCHEDULED_JOBS)의 intervalMinutes에서 파생해 주입한다
  // (createScheduler). 하드코딩 기본값을 두지 않아 주기 드리프트를 막는다.
  constructor(name: string, workIntervalMs: number, run: () => Promise<number>) {
    const config: SchedulerConfig = {
      name,
      workIntervalMs,
      logIntervalMs: 60 * 1000, // 1분마다 상태 로깅
    };

    super(config);
    this.run = run;
  }

  /**
   * 받은 작업을 실행하고 돌려받은 처리 건수를 `totalCount`로 넘긴다.
   */
  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();

    try {
      globalLogger.info(`[${this.config.name}] 🔄 Work started...`);

      const totalCount = await this.run();

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        startTime,
        endTime,
        durationMs,
        message: `Processed ${totalCount} items`,
        totalCount,
      };
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const failure = new Error(`Work failed: ${(error as Error).message}`);
      Object.assign(failure, {
        success: false,
        startTime,
        endTime,
        durationMs,
        error: error as Error,
      });
      throw failure;
    }
  }
}

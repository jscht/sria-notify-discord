import { BaseScheduler } from "./base/BaseScheduler";
import { RecruitService } from "@/services/recruitService";
import type { RecruitSource } from "@/common/types";
import type { SchedulerConfig, WorkResult } from "./types";

/**
 * 공고 갱신 스케줄러. (Phase 1.10 재정의 — 소스별 프로바이더 수집)
 * 사이트별로 인스턴스를 두어 소스별 스케줄·diff를 지원한다.
 */
export class RecruitScheduler extends BaseScheduler {
  private recruitService: RecruitService;
  private readonly source: RecruitSource;

  constructor(source: RecruitSource, workIntervalMs: number = 4 * 60 * 60 * 1000 /* 4시간 */) {
    const config: SchedulerConfig = {
      name: `RecruitScheduler:${source}`,
      workIntervalMs,
      logIntervalMs: 60 * 1000, // 1분마다 상태 로깅
    };

    super(config);
    this.source = source;
    this.recruitService = new RecruitService();
  }

  /**
   * 소스 프로바이더에서 공고를 수집→diff→(변경 시)RECRUIT_CHANGED 발행.
   */
  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();

    try {
      globalLogger.info(`[${this.config.name}] 🔄 Recruit sync started...`);

      const diff = await this.recruitService.syncRecruits(this.source);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const totalCount = diff.addedJobs.length + diff.updatedJobs.length;
      const message = `Collected ${totalCount} recruitment data (added/updated)`;

      return {
        success: true,
        startTime,
        endTime,
        durationMs,
        message,
        totalCount,
      };
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const failure = new Error(`Recruit sync failed: ${(error as Error).message}`);
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

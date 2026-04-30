import { BaseScheduler } from "./base/BaseScheduler";
import { CRAWL_MODE } from "@/common/constants";
import { RecruitService } from "@/services/recruitService";
import type { SchedulerConfig, WorkResult } from "./types";

/**
 * 채용공고 크롤링 스케줄러
 */
export class RecruitScheduler extends BaseScheduler {
  private recruitService: RecruitService;
  private mode: CRAWL_MODE;

  constructor(
    workIntervalMs: number = 4 * 60 * 60 * 1000, // 4시간
    mode: CRAWL_MODE = CRAWL_MODE.DUMMY
  ) {
    const config: SchedulerConfig = {
      name: "RecruitScheduler",
      workIntervalMs,
      logIntervalMs: 60 * 1000, // 1분마다 상태 로깅
    };

    super(config);
    this.recruitService = new RecruitService();
    this.mode = mode;
  }

  /**
   * 채용공고 크롤링 작업
   */
  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();

    try {
      globalLogger.info(
        `[${this.config.name}] 🔍 Crawling started (Mode: ${this.mode})...`
      );

      const { data: recruitData } = await this.recruitService.getRecruitList(this.mode);

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const totalCount = recruitData?.length || 0;
      const message = `Collected ${totalCount} recruitment data`;

      return {
        success: true,
        startTime,
        endTime,
        durationMs,
        message,
        totalCount
      };
    } catch (error) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      throw {
        success: false,
        startTime,
        endTime,
        durationMs,
        error: error as Error,
        message: `Crawling failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 크롤링 모드 변경
   */
  setMode(mode: CRAWL_MODE): void {
    this.mode = mode;
    globalLogger.info(`[${this.config.name}] Mode changed to: ${mode}`);
  }

  /**
   * 모드 조회
   */
  getMode(): CRAWL_MODE {
    return this.mode;
  }
}

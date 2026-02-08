import type { SchedulerConfig, SchedulerStatus, WorkResult } from "../types";
import { eventBus, EventType } from "@/events/bus";
import type {
  RecruitCrawlStartedEvent,
  RecruitCrawlCompletedEvent,
  RecruitCrawlFailedEvent,
} from "@/events/bus";
import { systemLogger as globalLogger } from "@/common/utils/systemLogger";

/**
 * 모든 스케줄러의 추상 클래스
 */
export abstract class BaseScheduler {
  protected isRunning = false;
  protected lastRunTime: Date | null = null;
  protected nextRunTime: Date | null = null;
  protected totalRunCount = 0;
  protected lastError: Error | null = null;
  protected workDurationMs: number | null = null;

  constructor(protected config: SchedulerConfig) {}

  /**
   * 각 구현체에서 정의할 실제 작업
   */
  protected abstract performWork(): Promise<WorkResult>;

  /**
   * 스케줄러 시작
   */
  startWork(): void {
    if (this.isRunning) {
      globalLogger.info(`[${this.config.name}] ⚠️ Scheduler is already running.`);
      return;
    }

    this.isRunning = true;
    globalLogger.info(`[${this.config.name}] ✅ Scheduler started.`);

    this.scheduleNextWork().catch((error) => {
      this.handleError(error);
      this.scheduleNextWork(); // 재시도
    });
  }

  /**
   * 다음 작업 스케줄링
   */
  private async scheduleNextWork(): Promise<void> {
    if (!this.isRunning) return;

    const startTime = Date.now();

    // STARTED 이벤트 발행
    eventBus.emitEvent<RecruitCrawlStartedEvent>(
      EventType.RECRUIT_CRAWL_STARTED,
      {
        timestamp: startTime,
        source: "BaseScheduler",
        schedulerName: this.config.name,
      }
    );

    try {
      const result = await this.performWork();

      this.lastRunTime = new Date();
      this.totalRunCount++;
      this.workDurationMs = Date.now() - startTime;
      this.lastError = null;

      // COMPLETED 이벤트 발행
      eventBus.emitEvent<RecruitCrawlCompletedEvent>(
        EventType.RECRUIT_CRAWL_COMPLETED,
        {
          timestamp: Date.now(),
          source: "BaseScheduler",
          schedulerName: this.config.name,
          totalCount: result.totalCount ?? 0,
          duration: this.workDurationMs,
        }
      );

      this.logWorkCompletion(result);
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // FAILED 이벤트 발행
      eventBus.emitEvent<RecruitCrawlFailedEvent>(
        EventType.RECRUIT_CRAWL_FAILED,
        {
          timestamp: Date.now(),
          source: "BaseScheduler",
          schedulerName: this.config.name,
          error: error as Error,
          duration: durationMs,
        }
      );

      this.handleError(error as Error);
    }

    // 다음 실행 스케줄링
    this.scheduleNextExecution();
  }

  /**
   * 다음 실행 스케줄링
   */
  private scheduleNextExecution(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const elapsed = now - (this.lastRunTime?.getTime() || now);
    const delay = Math.max(0, this.config.workIntervalMs - elapsed);

    this.nextRunTime = new Date(now + delay);

    setTimeout(() => {
      this.scheduleNextWork();
    }, delay);
  }

  /**
   * 작업 완료 로그
   */
  private logWorkCompletion(result: WorkResult): void {
    const duration = result.durationMs;
    const nextRunIn = this.getTimeUntilNextRun();

    globalLogger.info(
      `[${this.config.name}] ✅ Work completed ` +
      `(${duration}ms) | Next run: ${nextRunIn}`
    );
  }

  /**
   * 에러 처리
   */
  private handleError(error: Error): void {
    this.lastError = error;
    globalLogger.error(
      `[${this.config.name}] ❌ Work failed: ${error.message}`,
      error
    );
  }

  /**
   * 다음 실행까지 남은 시간 (읽기 좋은 형식)
   */
  private getTimeUntilNextRun(): string {
    if (!this.nextRunTime) return "Unknown";

    const remainingMs = Math.max(0, this.nextRunTime.getTime() - Date.now());
    const seconds = Math.floor(remainingMs / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  /**
   * 스케줄러 정지
   */
  stopWork(): void {
    this.isRunning = false;
    globalLogger.info(`[${this.config.name}] ⏹️ Scheduler stopped.`);
  }

  /**
   * 상태 조회
   */
  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.nextRunTime,
      totalRunCount: this.totalRunCount,
      lastError: this.lastError,
      workDurationMs: this.workDurationMs,
    };
  }
}

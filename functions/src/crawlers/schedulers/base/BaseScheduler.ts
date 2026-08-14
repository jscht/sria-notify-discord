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
   * 스케줄러 시작 (로컬 장기 실행 — setTimeout 재스케줄 루프).
   * 서버리스(onSchedule)는 이 메서드 대신 runOnce()를 직접 호출한다.
   */
  startWork(): void {
    if (this.isRunning) {
      globalLogger.info(`[${this.config.name}] ⚠️ Scheduler is already running.`);
      return;
    }

    this.isRunning = true;
    globalLogger.info(`[${this.config.name}] ✅ Scheduler started.`);

    void this.runOnce().finally(() => this.scheduleNextExecution());
  }

  /**
   * 단일 tick 실행 — STARTED 발행 → performWork → COMPLETED/FAILED 발행.
   * throw 없이 항상 WorkResult를 반환하며, 재스케줄(scheduleNextExecution)을 하지 않는다.
   * 서버리스 onSchedule 및 startWork 루프가 공유하는 실행 단위.
   */
  async runOnce(): Promise<WorkResult> {
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
      return result;
    } catch (thrown) {
      const durationMs = Date.now() - startTime;

      // performWork가 던지는 객체는 WorkResult 유사 형태(error/message 포함) — 안전 변환
      const err =
        thrown instanceof Error
          ? thrown
          : (thrown as { error?: Error })?.error ??
            new Error(String((thrown as { message?: string })?.message ?? thrown));
      const message = (thrown as { message?: string })?.message ?? err.message;

      // FAILED 이벤트 발행
      eventBus.emitEvent<RecruitCrawlFailedEvent>(
        EventType.RECRUIT_CRAWL_FAILED,
        {
          timestamp: Date.now(),
          source: "BaseScheduler",
          schedulerName: this.config.name,
          error: err,
          duration: durationMs,
        }
      );

      this.handleError(err);

      return {
        success: false,
        startTime: new Date(startTime),
        endTime: new Date(),
        durationMs,
        error: err,
        message: `[${this.config.name}] Work failed: ${message}`,
      };
    }
  }

  /**
   * 다음 실행 스케줄링 (로컬 장기 실행 전용)
   */
  private scheduleNextExecution(): void {
    if (!this.isRunning) return;

    const now = Date.now();
    const elapsed = now - (this.lastRunTime?.getTime() || now);
    const delay = Math.max(0, this.config.workIntervalMs - elapsed);

    this.nextRunTime = new Date(now + delay);

    setTimeout(() => {
      if (!this.isRunning) return;
      void this.runOnce().finally(() => this.scheduleNextExecution());
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

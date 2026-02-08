/**
 * 스케줄러 타입
 */

export interface SchedulerConfig {
  name: string;
  workIntervalMs: number;
  logIntervalMs: number;
}

export interface SchedulerStatus {
  isRunning: boolean;
  lastRunTime: Date | null;
  nextRunTime: Date | null;
  totalRunCount: number;
  lastError: Error | null;
  workDurationMs: number | null;
}

export interface WorkResult {
  success: boolean;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  error?: Error;
  message: string;
  totalCount?: number;
}

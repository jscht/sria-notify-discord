import { LogSource } from "../constants/logSource";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

export interface LogHandler {
  level: LogLevel;
  source: LogSource;
  message: string;
  timestamp: number;
  error?: string;
  data?: Record<string, any>; // context information
}
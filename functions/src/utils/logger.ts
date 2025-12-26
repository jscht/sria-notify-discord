import { LogHandler } from "../events/logHandler";
import { Provider } from "../constants/logSource";
import { formatDate } from "./formatDate";

class Logger {
  private readonly DEDUP_TTL = 60;

  private static log(log: LogHandler) {
    const timestamp = formatDate(new Date());
    const logLine = `[${timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`;

    const refLogMessage = `For detailed logs, please check: ${process.env.LOG_REF_URL}`;

    switch (log.level) {
      case "info": console.info(logLine, refLogMessage); break;
      case "debug": console.debug(logLine, refLogMessage); break;
      case "warn": console.warn(logLine, refLogMessage); break;
      case "error": console.error(logLine, refLogMessage); break;
    }
  }

  // Application Log Group
  static server = (message: string) => {
    const log = `[app:server] ${message}`;
    console.info(log);
  };
  static request = (message: string) => {
    const log = `[app:request] ${message}`;
    console.info(log);
  };

  // Application Process Debugging Log Group
  static crawler = (message: string, data?: any) => {
    const log = `[debug:crawler] ${message}`;
    if (!data) {
      console.debug(log);
    }
    console.debug(log, data);
  };
  static provider = (message: string, provider: Provider) => {
    const log = `[debug:provider:${provider}] ${message}`;
    console.debug(log);
  };

  // Application Error, Failure Log Group
  static error = (message: string, error?: Error) => {
    const log = `[error:server] ${message}`;
    if (!error) {
      console.error(log);
    } else {
      console.error(log, error?.message);
    }
  };
  static fail = (message: string) => {
    const log = `[error:request] ${message}`;
    console.error(log);
  };
  static warn = (message: string) => {
    const log = `[warn:request] ${message}`;
    console.warn(log);
  };
}

global.DebugLogger = Logger;

export default Logger;

type Provider = "firebase" | "firestore" | "discord";

class Logger {
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
  static provider = (message: string, provider: Provider, data?: any) => {
    const log = `[debug:provider] ${provider}:${message}`;
    if (!data) {
      console.debug(log);
    }
    console.debug(log, data);
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

import fs from "node:fs";
import path from "node:path";

/**
 * 전역 에러 핸들러(A) — 최후의 거름망.
 *
 * 어디서도 처리되지 않은 Promise rejection / 동기 예외가 프로세스를 종료시키는 것을 막는다.
 * 봇·서버가 단일 Node 프로세스(`initDiscordBot` + `initExpress`/`firebaseDeploy`)이므로
 * 이 핸들러 하나가 전역(봇·Express·Functions·EventBus·크롤러 등)을 커버한다.
 * 로컬 try/catch가 1차 방어이고, 그걸 모두 빠져나온 것만 여기로 온다.
 *
 * 환경 분기:
 * - 에뮬레이터/dev: 콘솔 + 파일 기록 후 **프로세스 생존**(테스트 중단 방지 + 스택 확보).
 * - prod(Cloud Functions): 콘솔(→Cloud Logging)만. `uncaughtException` 시 **종료**해
 *   플랫폼이 깨끗한 인스턴스로 재활용하게 한다(오염된 상태를 끌고 가지 않음).
 *
 * TODO(후순위): ① 출처(서브시스템) 분류·라우팅 ② prod graceful 종료(연결 정리·flush 후 재시작).
 *   상세 결정 근거는 메모리 `global-error-handler-deferred-scope` 참조.
 */
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const CRASH_LOG_PATH = path.resolve(process.cwd(), "logs", "unhandled-crash.log");

/**
 * 크래시 스택을 파일에 **동기** 기록한다(에뮬레이터 전용).
 * prod는 파일시스템이 읽기 전용이고 Cloud Logging을 쓰므로 기록하지 않는다.
 * 동기 기록인 이유: 프로세스 종료 직전이라도 디스크에 확실히 남기기 위함.
 */
function appendCrashLog(kind: string, err: unknown): void {
  if (!isEmulator) return;
  try {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    const entry =
      `\n[${new Date().toISOString()}] ${kind}\n${stack}\n` +
      "----------------------------------------\n";
    fs.mkdirSync(path.dirname(CRASH_LOG_PATH), { recursive: true });
    fs.appendFileSync(CRASH_LOG_PATH, entry);
  } catch {
    // 로깅 실패가 또 다른 미처리 예외를 만들지 않도록 의도적으로 무시한다.
  }
}

let registered = false;

/**
 * 전역 에러 핸들러를 등록한다. Cold start 중복 등록을 방지하기 위해 1회만 동작한다.
 * `globalLogger`가 준비된 뒤(= `@/common/utils/systemLogger` 로드 후) 호출해야 한다.
 */
export function registerGlobalErrorHandlers(): void {
  if (registered) return;
  registered = true;

  process.on("unhandledRejection", (reason) => {
    globalLogger.error("[unhandledRejection] 처리되지 않은 Promise 거부", reason as Error);
    appendCrashLog("unhandledRejection", reason);
    // rejection은 dev·prod 공통으로 일단 생존시켜 로그를 확보한다(prod 정책 강화는 후순위).
  });

  process.on("uncaughtException", (err) => {
    globalLogger.error("[uncaughtException] 처리되지 않은 예외", err);
    appendCrashLog("uncaughtException", err);
    if (!isEmulator) {
      // prod: 오염 가능성이 있는 상태를 유지하지 않고 종료 → 플랫폼이 클린 인스턴스로 재활용.
      process.exit(1);
    }
    // 에뮬레이터: 종료하지 않고 생존시켜 테스트를 계속할 수 있게 한다.
  });
}

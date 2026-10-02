import { createClient, RedisClientType } from "redis";
import { ENV, SystemError } from "@/common/utils";

// ──────────────────────────────────────────────────────────────
// O-3: Redis 재연결 전략 상수 (지수 백오프 + 상한 + jitter)
// ──────────────────────────────────────────────────────────────
const RECONNECT_BASE_DELAY_MS = 200;
const RECONNECT_MAX_DELAY_MS = 10_000; // 재시도 간격 상한 10초
const RECONNECT_MAX_RETRIES = 20; // 상한 도달 시 포기(누적 약 3분)

/**
 * node-redis v4 `socket.reconnectStrategy` 팩토리.
 * retries 회차별로 지수 백오프(base * 2^retries, 상한 10초)에 ±20% jitter를 적용한
 * 대기시간(ms)을 반환한다. RECONNECT_MAX_RETRIES를 초과하면 Error를 반환해
 * 재연결을 포기시킨다(무한 재시도 방지).
 */
function buildReconnectStrategy(): (retries: number) => number | Error {
  return (retries: number) => {
    if (retries > RECONNECT_MAX_RETRIES) {
      return new Error("Redis reconnect attempts exhausted");
    }
    const exp = RECONNECT_BASE_DELAY_MS * 2 ** retries;
    const jittered = exp * (0.8 + Math.random() * 0.4); // ±20% jitter
    // 상한(10초)은 jitter 적용 "후"에 걸어 실제 대기시간이 RECONNECT_MAX_DELAY_MS를 넘지 않도록 한다.
    return Math.floor(Math.min(RECONNECT_MAX_DELAY_MS, jittered));
  };
}

export async function redisConnection() {
  try {
    // ──────────────────────────────────────────────────────────────
    // 배포 환경(원격 Redis) 전환 가이드:
    //   .env의 REDIS_URL만 교체하면 됨. 코드 변경 불필요.
    //   - 로컬:  REDIS_URL=redis://127.0.0.1:6379
    //     (localhost 대신 127.0.0.1 명시 — Node DNS가 ::1을 우선 해석하여
    //      IPv4 listen Redis에 연결 실패하는 OS 특성을 피하기 위함)
    //   - 원격:  REDIS_URL=rediss://<user>:<password>@<host>:<port>
    //     · `rediss://`(s 두 개) = TLS. 평문 `redis://`와 혼동 주의
    //     · password에 @, :, /, # 등 특수문자가 있으면 URL 인코딩 필요
    //     · ACL 사용 시 user 부분(기본값 `default`) 명시
    //   - TLS/인증 외 세부 옵션(socket.tls 옵션 등)이 필요하면
    //     `createClient({ url, socket: { tls: true, ... } })` 형태로 확장
    // ──────────────────────────────────────────────────────────────
    const client: RedisClientType = createClient({
      url: ENV.REDIS_URL,
      socket: { reconnectStrategy: buildReconnectStrategy() },
    });

    // on("error") 리스너는 반드시 connect() 이전에 등록 — 리스너가 없으면
    // node-redis v4가 emit하는 error 이벤트를 Node가 unhandled로 간주해 프로세스를 크래시시킨다.
    // 흡수만 하고 절대 throw/rethrow 하지 않는다(SystemError 생성자가 자동 로깅).
    client.on("error", (err: Error) => {
      SystemError.redisError("Redis client error (auto-recovering)", err, { phase: "runtime" });
    });

    client.on("ready", () => {
      globalLogger.info("redis connected.");
    });

    await client.connect();

    return client;
  } catch (error) {
    if (error instanceof Error) {
      globalLogger.error("Redis connection failed:", error);
    }
    return null;
  }
}

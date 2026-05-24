import { createClient, RedisClientType } from "redis";
import { ENV } from "@/common/utils";

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
};

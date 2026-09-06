import "@/common/utils/systemLogger";
import crypto from "node:crypto";
import { RedisManager } from "@/providers/redis/manager/redisManager";

/**
 * 프록시 소진 incident 추적 (Phase 1.10 · Redis).
 *
 * 목적: 개발자 DM을 incident당 1회로 제한하고, incident id로 발생/복구 로그를
 * 짝지어 "다른 시기의 장애"를 구분한다. 사용자 staleness 알림엔 쓰로틀이 없으므로
 * 사용자용 상태는 두지 않는다.
 */
const INCIDENT_KEY = "proxy:incident";

export interface ProxyIncident {
  id: string;
  startedAt: number;
}

export const proxyIncident = {
  /**
   * 진행 중 incident가 없으면 새로 열고 {id, startedAt} 반환(=새 장애).
   * 이미 열려 있으면 null. Redis 오류 시 안전하게 새 장애로 간주(개발자 알림 우선).
   */
  async openIfAbsent(): Promise<ProxyIncident | null> {
    const incident: ProxyIncident = {
      id: crypto.randomUUID().slice(0, 8),
      startedAt: Date.now(),
    };
    try {
      const opened = await RedisManager.getInstance().setIfAbsent(
        INCIDENT_KEY,
        JSON.stringify(incident)
      );
      return opened ? incident : null;
    } catch (error) {
      globalLogger.warn("proxyIncident.openIfAbsent Redis 오류 — 새 장애로 간주");
      return incident;
    }
  },

  /**
   * 진행 중 incident가 있으면 종료하고 {id, startedAt, durationMs} 반환, 없으면 null.
   */
  async resolve(): Promise<(ProxyIncident & { durationMs: number }) | null> {
    try {
      const redis = RedisManager.getInstance();
      const raw = await redis.getValue(INCIDENT_KEY);
      if (!raw) return null;
      await redis.deleteKey(INCIDENT_KEY);
      const incident = JSON.parse(raw) as ProxyIncident;
      return { ...incident, durationMs: Date.now() - incident.startedAt };
    } catch (error) {
      globalLogger.warn("proxyIncident.resolve Redis 오류");
      return null;
    }
  },
};

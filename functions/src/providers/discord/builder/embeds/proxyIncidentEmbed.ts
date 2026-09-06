import { APIEmbed, EmbedBuilder } from "discord.js";

/** 개발자 긴급 알림 색상 (레드). */
const INCIDENT_COLOR = 0xff0000;

/** 개발자 incident 임베드 입력 (계층 독립 — event/service 타입 미참조). */
export interface ProxyIncidentEmbedInput {
  incidentId: string;
  startedAt: number;
  reason: string;
  attempts: number;
  lastProxyIp?: string;
}

/** ms 타임스탬프를 Asia/Seoul "YYYY-MM-DD HH:mm:ss"로. */
function formatKst(ts: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * 프록시 소진 incident 시작 시 개발자에게 보내는 긴급 임베드. (Phase 1.10)
 *
 * incident id·발생 시각을 포함해, 다른 시기의 장애와 구분 가능하게 한다.
 * (복구 DM은 없고 RESOLVED 로그로 짝지어 확인 — 설계 §2.8.)
 * provider 계층 규칙 준수 — event/service 타입에 의존하지 않는다(primitive 입력).
 */
export function proxyIncidentEmbed(input: ProxyIncidentEmbedInput): APIEmbed {
  return new EmbedBuilder()
    .setColor(INCIDENT_COLOR)
    .setTitle("🚨 프록시 소진 - 크롤링 중단")
    .setDescription("가용 프록시가 없어 스케줄 크롤이 중단되었습니다. 즉시 확인이 필요합니다.")
    .addFields(
      { name: "incident", value: `\`${input.incidentId}\``, inline: true },
      { name: "발생", value: formatKst(input.startedAt), inline: true },
      { name: "reason", value: input.reason, inline: true },
      { name: "attempts", value: String(input.attempts), inline: true },
      ...(input.lastProxyIp
        ? [{ name: "lastProxyIp", value: input.lastProxyIp, inline: true }]
        : [])
    )
    .setTimestamp()
    .toJSON();
}

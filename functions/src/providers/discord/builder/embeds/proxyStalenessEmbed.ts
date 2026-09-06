import { APIEmbed, EmbedBuilder } from "discord.js";
import { ENV } from "@/common/utils";

/** 신선도 안내 색상 (앰버). */
const STALENESS_COLOR = 0xf5a623;

/**
 * ms 타임스탬프를 "YYYY-MM-DD HH:mm (약 N시간 전)" 형식(절대+상대 병기)으로 포맷한다.
 * 절대시각은 Asia/Seoul 기준.
 */
function formatAsOf(ts: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const absolute = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;

  return `${absolute} (${formatRelative(Date.now() - ts)})`;
}

/** 경과 ms를 "약 N분/시간/일 전"으로. */
function formatRelative(elapsedMs: number): string {
  const min = Math.floor(elapsedMs / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `약 ${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `약 ${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `약 ${days}일 전`;
}

/**
 * 프록시/크롤 갱신 실패 시 구독자에게 보내는 신선도 안내 임베드. (Phase 1.10)
 *
 * 내부 원인(프록시/크롤 중단)은 노출하지 않고, 마지막 갱신 시각(as-of)과
 * 사람인 직접 확인 링크만 안내한다.
 *
 * @param lastRefreshedAt 마지막 성공 크롤 시각(ms). 없으면 "알 수 없음".
 */
export function proxyStalenessEmbed(lastRefreshedAt: number | null): APIEmbed {
  const baseUrl = ENV.SRIA_URL;
  const asOf = lastRefreshedAt !== null ? formatAsOf(lastRefreshedAt) : "알 수 없음";

  const lines = [
    "최신 공고를 일시적으로 갱신하지 못했어요.",
    `마지막 갱신: ${asOf}`,
    "최신 공고는 아래에서 확인하실 수 있어요.",
    baseUrl ? `🔗 [사람인 바로가기](${baseUrl})` : "🔗 사람인에서 직접 확인해 주세요",
  ];

  return new EmbedBuilder()
    .setColor(STALENESS_COLOR)
    .setDescription(lines.join("\n"))
    .setTimestamp()
    .toJSON();
}

import type { APIEmbed, MessageCreateOptions } from "discord.js";
import { Routes } from "discord.js";
import { rest } from "@/providers/discord/client";
import { providerLogger } from "@/common/utils/systemLogger";

/**
 * DM 발송 페이로드 — 포맷 무관(format-agnostic).
 *
 * 호출 측(이벤트 핸들러)이 빌더로 완성한 embeds/content를 그대로 전달한다.
 * 포맷(title/recruits 등)을 시그니처에 박지 않는다 — 후속 4개 Phase(1.9/1.10/2.1/2.2)의 계약.
 */
export interface DmPayload {
  /** 완성된 임베드 배열 (호출 측 빌더 산출물, 예: notificationMessageEmbed). */
  embeds?: MessageCreateOptions["embeds"];
  /** 임베드 대신/병행할 평문 메시지. */
  content?: string;
}

/**
 * DM 발송 결과 — 성공 / graceful skip / 실패 3분기.
 *
 * 호출 측(핸들러)이 NOTIFICATION_SENT 발행 여부·success 플래그를 판정하는 데 사용한다.
 */
export interface DmSendResult {
  /** 전송 성공 여부. skip(=차단)도 ok=false, skipped=true로 구분. */
  ok: boolean;
  /** DM 차단/공유 길드 없음(50007) 등 "보낼 수 없는 정상 상태" → 재시도·에러 아님. */
  skipped?: boolean;
  /** ok=false일 때 사유 코드/요약 ("dm_disabled" | "unknown_user" | "max_retries"). */
  reason?: string;
  /** Discord API 에러 코드 (50007 / 10013 등), 있으면 기록용. */
  errorCode?: number;
  /** 총 소요 시간(ms) — 로깅·관찰용. */
  durationMs: number;
  /** 실제 시도 횟수. */
  attempts: number;
}

/** 최대 시도 횟수 (최초 1 + 재시도 2). */
const MAX_ATTEMPTS = 3;
/** 일시 오류 시 짧은 backoff 기준(ms). */
const BASE_BACKOFF_MS = 500;
/** DM 차단 / 공유 길드 없음 → graceful skip. */
const ERR_DM_DISABLED = 50007;
/** Unknown User → 재시도 없이 실패. */
const ERR_UNKNOWN_USER = 10013;
/** rate limit 대기값이 없을 때의 기본 대기(ms). */
const FALLBACK_RATE_LIMIT_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * discord.js 14.17 에러에서 수치 코드만 추출한다.
 *
 * `DiscordAPIError.code`는 `number | string`이므로 number일 때만 반환한다.
 * RateLimitError는 `code`가 없어 undefined가 된다.
 */
function getErrorCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

/**
 * rate limit 대기 시간(ms)을 추출한다.
 *
 * discord.js 14.17의 RateLimitError는 `retryAfter`/`timeToReset`을 **밀리초**로 제공한다
 * (초 아님 — `*1000` 보정 금지). DiscordAPIError.status === 429인 경우도 방어적으로 처리한다.
 *
 * @returns rate limit 대기(ms). rate limit이 아니면 undefined.
 */
function getRateLimitWaitMs(error: unknown): number | undefined {
  const e = error as {
    retryAfter?: number;
    timeToReset?: number;
    status?: number;
    name?: string;
  };

  // RateLimitError: retryAfter / timeToReset 둘 다 ms 단위.
  if (typeof e.retryAfter === "number") return e.retryAfter;
  if (typeof e.timeToReset === "number") return e.timeToReset;

  // DiscordAPIError 등에서 HTTP 429만 감지된 경우 — 대기값 미상 → fallback.
  if (e.status === 429 || e.name === "RateLimitError") return FALLBACK_RATE_LIMIT_MS;

  return undefined;
}

/**
 * DmPayload.embeds(빌더 가능)를 REST body용 APIEmbed[]로 정규화한다.
 * 빌더(.toJSON 존재)면 toJSON(), 이미 API 객체면 통과. embeds 없으면 undefined.
 * @remarks 계약 밖 내부 변환 — DmPayload 필드·의미 불변.
 */
function toApiEmbeds(embeds: DmPayload["embeds"]): APIEmbed[] | undefined {
  if (!embeds) return undefined;
  return embeds.map((e) =>
    typeof (e as { toJSON?: unknown }).toJSON === "function"
      ? (e as { toJSON(): APIEmbed }).toJSON()
      : (e as APIEmbed)
  );
}

/**
 * 지정한 사용자에게 알림 DM을 발송한다.
 *
 * 포맷 무관(embeds 기반) — 임베드는 호출 측이 빌더로 완성해 전달한다.
 * providers 계층 규칙에 따라 예외를 throw하지 않고 모든 결과를 {@link DmSendResult}로
 * 흡수해 반환한다(graceful degradation). 조율(이벤트 발행 등)은 호출 측이 결과로 판단한다.
 *
 * 에러 분류:
 * - 50007 (DM 차단/공유 길드 없음) → 재시도 없이 graceful skip
 * - 10013 (Unknown User) → 재시도 없이 실패
 * - 429 / RateLimitError → 대기(ms, *1000 금지) 후 재시도
 * - 그 외 미지 코드 → 짧은 backoff 후 재시도, 소진 시 실패
 *
 * @param userId 대상 Discord 사용자 ID
 * @param payload 발송할 embeds/content (포맷 무관)
 * @returns 발송 결과 (성공/skip/실패 + 소요시간·시도횟수)
 */
export async function sendNotificationDM(
  userId: string,
  payload: DmPayload
): Promise<DmSendResult> {
  const startedAt = Date.now();
  let attempts = 0;

  // REST 전용 경로 — gateway 로그인/ready 빗장 불필요. setToken만으로 호출 성립.
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      // 1) DM 채널 개설 — POST /users/@me/channels { recipient_id }
      const dmChannel = (await rest.post(Routes.userChannels(), {
        body: { recipient_id: userId },
      })) as { id: string };
      // 2) 메시지 전송 — POST /channels/{id}/messages
      await rest.post(Routes.channelMessages(dmChannel.id), {
        body: { embeds: toApiEmbeds(payload.embeds), content: payload.content },
      });

      const durationMs = Date.now() - startedAt;
      providerLogger.info("DM 발송 성공", { userId, durationMs, attempts });
      return { ok: true, durationMs, attempts };
    } catch (error) {
      const code = getErrorCode(error);

      // (1) DM 차단 / 공유 길드 없음 → 재시도 없이 graceful skip.
      if (code === ERR_DM_DISABLED) {
        const durationMs = Date.now() - startedAt;
        providerLogger.warn("DM 차단 skip (DM 차단/공유 길드 없음)", {
          userId,
          errorCode: code,
          durationMs,
          attempts,
        });
        return {
          ok: false,
          skipped: true,
          reason: "dm_disabled",
          errorCode: code,
          durationMs,
          attempts,
        };
      }

      // (2) Unknown User → 재시도 없이 실패.
      if (code === ERR_UNKNOWN_USER) {
        const durationMs = Date.now() - startedAt;
        providerLogger.error("DM 발송 실패 (Unknown User)", error as Error, {
          userId,
          errorCode: code,
          durationMs,
          attempts,
        });
        return {
          ok: false,
          reason: "unknown_user",
          errorCode: code,
          durationMs,
          attempts,
        };
      }

      // (3) Rate limit → 대기(ms, *1000 금지) 후 재시도.
      const rateLimitWaitMs = getRateLimitWaitMs(error);
      if (rateLimitWaitMs != null) {
        if (attempts >= MAX_ATTEMPTS) break;
        providerLogger.warn("DM 발송 rate limit — 대기 후 재시도", {
          userId,
          waitMs: rateLimitWaitMs,
          attempts,
        });
        await sleep(rateLimitWaitMs);
        continue;
      }

      // (4) 그 외 미지 코드 → 일시 오류로 보고 짧은 backoff 후 재시도.
      if (attempts >= MAX_ATTEMPTS) break;
      providerLogger.warn("DM 발송 일시 오류 — backoff 후 재시도", {
        userId,
        errorCode: code,
        attempts,
      });
      await sleep(BASE_BACKOFF_MS * attempts);
      continue;
    }
  }

  // 재시도 소진 → 실패.
  const durationMs = Date.now() - startedAt;
  providerLogger.error("DM 발송 실패 (재시도 소진)", undefined, {
    userId,
    reason: "max_retries",
    durationMs,
    attempts,
  });
  return { ok: false, reason: "max_retries", durationMs, attempts };
}

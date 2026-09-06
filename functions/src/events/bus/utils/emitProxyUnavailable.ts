import "@/common/utils/systemLogger";
import { eventBus } from "../EventBus";
import { EventType } from "../types";
import type { ProxyUnavailableEvent } from "../types";

/**
 * PROXY_UNAVAILABLE 발행 공용 헬퍼. (Phase 1.10)
 *
 * 스케줄 갱신(crawlAndDiff) 프록시 소진 시에만 호출한다(능동 요청 실패는 발행 안 함).
 * 틱 완결 파이프라인을 위해 `awaitSettle`로 핸들러(DM 발송)까지 대기할 수 있다.
 *
 * @param reason 소진 유형
 * @param attempts 시도 횟수
 * @param source 발행 출처 식별 문자열
 * @param opts.awaitSettle true면 emitEventAndSettle await(핸들러 완료까지), false면 fire-and-forget
 * @param lastProxyIp 마지막 시도 프록시 IP (선택)
 */
export async function emitProxyUnavailable(
  reason: ProxyUnavailableEvent["reason"],
  attempts: number,
  source: string,
  opts: { awaitSettle: boolean },
  lastProxyIp?: string
): Promise<void> {
  const payload: ProxyUnavailableEvent = {
    timestamp: Date.now(),
    source,
    reason,
    attempts,
    lastProxyIp,
  };
  try {
    if (opts.awaitSettle) {
      await eventBus.emitEventAndSettle<ProxyUnavailableEvent>(EventType.PROXY_UNAVAILABLE, payload);
    } else {
      eventBus.emitEvent<ProxyUnavailableEvent>(EventType.PROXY_UNAVAILABLE, payload);
    }
  } catch (error) {
    globalLogger.error("PROXY_UNAVAILABLE 이벤트 발행 실패", error as Error, { source });
  }
}

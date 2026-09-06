/**
 * services 계층 전용 에러. (Phase 1.10)
 */

/**
 * 프록시가 소진돼 크롤을 수행하지 못한 신호 (services 계층).
 *
 * `crawlService.crawlWithProxyRotation`이 throw하고, 호출자가 경로에 따라 처리한다:
 * - 스케줄러(crawlAndDiff) → `PROXY_UNAVAILABLE` 발행(전체 staleness 알림)
 * - 능동 요청(getRecruitList) → `HttpError.ServiceUnavailable`로 변환(요청자에게만)
 */
export class ProxyExhaustedError extends Error {
  constructor(
    public readonly reason: "no_available_proxy" | "all_proxies_failed",
    public readonly attempts: number,
    public readonly lastProxyIp?: string
  ) {
    super(`프록시 소진: ${reason} (attempts=${attempts})`);
    this.name = "ProxyExhaustedError";
  }
}

/**
 * 크롤러 계층 전용 에러. (Phase 1.10)
 */

/**
 * 프록시를 통한 크롤이 차단·실패로 감지된 신호.
 *
 * SriaCrawler(executor)가 throw하고, 상위(crawlService)가 받아
 * `markProxyAsFailed` + 다른 프록시 재시도를 판단한다.
 */
export class ProxyBlockedError extends Error {
  constructor(message = "프록시 차단/실패 감지") {
    super(message);
    this.name = "ProxyBlockedError";
  }
}

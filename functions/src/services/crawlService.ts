import { CRAWL_MODE } from "@/common/constants/crawlMode";
import type { CityKo } from "@/common/types";
import { getCityFilteredList } from "@/common/utils";
import { SriaCrawler, ProxyCrawler } from "@/crawlers/strategies";
import type { RecruitData, ProxyData } from "@/crawlers/types";
import { toProxyServer, getDelay } from "@/crawlers/utils";
import { RedisManager } from "@/providers/redis/manager/redisManager";
import { CrawlCacheStore } from "@/providers/redis/store";
import { ProxyService } from "./proxyService";
import { ProxyExhaustedError } from "./errors";

/** 프록시 로테이션 최대 시도 횟수(세션 고정 + 실패 시 교체). */
const MAX_PROXY_ATTEMPTS = 3;

export class CrawlService {
  private readonly crawl_cachestore: CrawlCacheStore;
  private readonly sriaCrawler: SriaCrawler;
  private readonly proxyCrawler: ProxyCrawler;
  private readonly proxyService: ProxyService;

  constructor() {
    this.crawl_cachestore = RedisManager.getInstance().store.crawl;
    this.sriaCrawler = new SriaCrawler();
    this.proxyCrawler = new ProxyCrawler();
    this.proxyService = new ProxyService();
  }

  async sriagent(mode: CRAWL_MODE, city?: CityKo): Promise<RecruitData[] | undefined> {
    let scraped: RecruitData[] | undefined;

    if (mode === CRAWL_MODE.CRAWL) {
      // Phase 1.10: 프록시 게이트 + 세션고정·실패교체 로테이션. 소진 시 ProxyExhaustedError.
      scraped = await this.crawlWithProxyRotation();
    }

    // 이벤트 전파 됐을 때 구독 유형(구독한 도시)에 맞춰 필터링된 데이터 반환 -> 다른 서비스 레이어에서 처리
    // Phase 1.10: mode 하드코딩 버그 수정 — CRAWL 모드에서 실크롤 결과(scraped)가 필터로 전달되게.
    return await getCityFilteredList(mode, city, scraped);
  }

  /**
   * 프록시 게이트 + 세션고정·실패교체(≤3) 로테이션. (Phase 1.10)
   *
   * 소진 시 이벤트를 발행하지 않고 `ProxyExhaustedError`를 throw만 한다 —
   * 발행 여부는 호출자(스케줄러 vs 능동 요청)가 결정한다(전체 브로드캐스트 격리).
   */
  private async crawlWithProxyRotation(): Promise<RecruitData[]> {
    if (!(await this.proxyService.hasAvailableProxy())) {
      throw new ProxyExhaustedError("no_available_proxy", 0);
    }

    let lastProxyIp: string | undefined;
    for (let attempt = 1; attempt <= MAX_PROXY_ATTEMPTS; attempt++) {
      const proxy = await this.proxyService.getAvailableProxy(); // 세션 고정 checkout
      if (!proxy) break;
      lastProxyIp = proxy.ipAddress;
      try {
        const data = await this.sriaCrawler.crawl(toProxyServer(proxy));
        await this.proxyService.releaseProxy(proxy.ipAddress); // 성공 → 풀 반환
        return data;
      } catch (error) {
        await this.proxyService.markProxyAsFailed(proxy.ipAddress); // 차단/실패 → 제외
        await this.backoff(attempt); // 지수 백오프(getDelay 지터)
      }
    }

    throw new ProxyExhaustedError("all_proxies_failed", MAX_PROXY_ATTEMPTS, lastProxyIp);
  }

  /** 시도 횟수 기반 지수 백오프(지터 포함). */
  private backoff(attempt: number): Promise<void> {
    const waitMs = getDelay(attempt, attempt + 1); // attempt~attempt+1초 랜덤
    return new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async proxy(): Promise<ProxyData[]> {
    return await this.proxyCrawler.crawl();
  }

  async isRequestAllowed(): Promise<boolean> {
    const limited = await this.crawl_cachestore.isRequestLimitSet();

    if (!limited) {
      await this.crawl_cachestore.setRequestLimit();
    }

    return !limited;
  }
}

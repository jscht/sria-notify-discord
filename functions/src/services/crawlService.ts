import { CRAWL_MODE } from "@/common/constants/crawlMode";
import type { CityKo } from "@/common/types";
import { getCityFilteredList } from "@/common/utils";
import { SriaCrawler, ProxyCrawler } from "@/crawlers/strategies";
import type { RecruitData, ProxyData } from "@/crawlers/types";
import { RedisManager } from "@/providers/redis/manager/redisManager";
import { CrawlCacheStore } from "@/providers/redis/store";

export class CrawlService {
  private readonly crawl_cachestore: CrawlCacheStore;
  private readonly sriaCrawler: SriaCrawler;
  private readonly proxyCrawler: ProxyCrawler;

  constructor() {
    this.crawl_cachestore = RedisManager.getInstance().store.crawl;
    this.sriaCrawler = new SriaCrawler();
    this.proxyCrawler = new ProxyCrawler();
  }

  async sriagent(mode: CRAWL_MODE, city?: CityKo): Promise<RecruitData[] | undefined> {
    let scraped: RecruitData[] | undefined;

    if (mode === CRAWL_MODE.CRAWL) {
      scraped = await this.sriaCrawler.crawl();
    }

    // 이벤트 전파 됐을 때 구독 유형(구독한 도시)에 맞춰 필터링된 데이터 반환 -> 다른 서비스 레이어에서 처리
    return await getCityFilteredList(CRAWL_MODE.DUMMY, city, scraped);
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

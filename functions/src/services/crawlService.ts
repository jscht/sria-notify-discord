import { CRAWL_MODE } from "../constants/crawlMode";
import { SriaCrawler, ProxyCrawler } from "@/crawlers/strategies";
import type { RecruitData, ProxyData } from "@/crawlers/types";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { CrawlCacheStore } from "../providers/redis/store";
import { CityKo } from "../types/city";
import { getCityFilteredList } from "../utils/getCityFilteredList";

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

import { CRAWL_MODE } from "../constants/crawlMode";
import { crawler, scheduler } from "../crawlers";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { CrawlCacheStore } from "../providers/redis/store";
import { CityKo } from "../types/city";
import { Crawler, Scheduler } from "../types/crawler";
import { ResponseRecruitData } from "../types/responseRecruitData";
import { getCityFilteredList } from "../utils/getCityFilteredList";

export class CrawlService {
  private readonly crawl_cachestore: CrawlCacheStore;
  private readonly crawler: Crawler;
  private readonly scheduler: Scheduler;

  constructor() {
    this.crawl_cachestore = RedisManager.getInstance().store.crawl;
    this.crawler = crawler;
    this.scheduler = scheduler;
  }

  async sriagent(mode: CRAWL_MODE, city?: CityKo) {
    let scraped: ResponseRecruitData[] | undefined;

    if (mode === CRAWL_MODE.CRAWL) {
      scraped = await this.crawler.sriagent();
    }

    return await getCityFilteredList(CRAWL_MODE.DUMMY, city, scraped);
  }

  async proxy() {
    return await this.crawler.proxy();
  }

  async isRequestAllowed() {
    const limited = await this.crawl_cachestore.isRequestLimitSet();

    if (!limited) {
      await this.crawl_cachestore.setRequestLimit();
    }

    return !limited;
  }
};
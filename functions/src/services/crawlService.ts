import { CRAWL_MODE } from "../constants/crawlMode";
import { crawler, scheduler } from "../crawlers";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { CrawlCacheStore } from "../providers/redis/store";
import { CityKo } from "../types/city";
import { Crawler, Scheduler } from "../types/crawler";
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

  async sriagent(mode?: CRAWL_MODE, city?: CityKo) {
    const { DUMMY, CRAWL } = CRAWL_MODE;
    let result = null;

    if (!mode || mode === DUMMY) {
      result = await getCityFilteredList(DUMMY, city);
    } else if (mode === CRAWL) {
      const scraped = await this.crawler.sriagent();
      result = await getCityFilteredList(CRAWL, city, scraped);
    }

    return result;
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
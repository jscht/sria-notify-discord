import { CRAWL_MODE } from "../constants/crawlMode";
import { RecruitCacheStore } from "../providers/redis/store";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";
import { CrawlService } from "./crawlService";
import { CityKo } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import { cityNameConverter } from "../utils/cityName";
import { getCityFilteredList } from "../utils/getCityFilteredList";
import { HttpError } from "../utils/httpError";
import { isValidCityName } from "../utils/cityName";

export class RecruitService {
  private readonly recruit_cachestore: RecruitCacheStore;
  private readonly recruit_firestore: RecruitStore;
  private readonly crawlService: CrawlService;

  constructor() {
    this.recruit_cachestore = RedisManager.getInstance().store.recruit;
    this.recruit_firestore = new RecruitStore();
    this.crawlService = new CrawlService();
  }

  async getRecruitList(mode: CRAWL_MODE, city?: any) {
    const cityKo = city ? cityNameConverter.toKorean(city) : undefined;

    // Validate city name
    if (city && !isValidCityName(city)) {
      DebugLogger.warn("Invalid city name.");
      throw HttpError.BadRequest("Invalid city name.");
    }

    // 1. Check Redis Cache
    const cachedList = await this.recruit_cachestore.getRecruitListFromCache();

    if (cachedList) {
      const list: ResponseRecruitData[] = cachedList;
      DebugLogger.server("Returning recruit list from Redis cache.");
      return getCityFilteredList(mode, cityKo, list);
    }

    // 2. Check Firestore
    const firestoreData = await this.recruit_firestore.getRecruitList();

    if (firestoreData?.recruitList?.length > 0) {
      const list: ResponseRecruitData[] = firestoreData?.recruitList;
      DebugLogger.server("Returning recruit list from Firestore.");

      // Cache update
      await this.recruit_cachestore.setRecruitListToCache(list);
      return getCityFilteredList(mode, cityKo, list);
    }

    // 3. Request Crawling
    // 직접적인 크롤링 요청에 10분 제한(redis, firestore 둘 다 장애 시)
    const canRequest = await this.crawlService.isRequestAllowed();

    if (!canRequest) {
      DebugLogger.error("Crawling request limited.");
      throw HttpError.TooManyRequests();
    }

    const crawledData = await this.collectAndSaveRecruits(mode, cityKo);

    if (!crawledData) {
      DebugLogger.error("Crawling failed.");
      throw HttpError.ServiceUnavailable();
    }

    DebugLogger.server("Returning recruit list from crawler.");
    return getCityFilteredList(mode, cityKo, crawledData);
  }

  private async collectAndSaveRecruits(mode: CRAWL_MODE, city?: CityKo) {
    const list = await this.crawlService.sriagent(mode, city);

    if (!Array.isArray(list)) {
      throw new Error("Result is not an array.");
    }

    if (list.length === 0) {
      throw new Error("Result is empty.");
    }

    await Promise.all([
      this.recruit_firestore.saveRecruitList(list),
      this.recruit_cachestore.setRecruitListToCache(list),
    ]);

    return list;
  }
};
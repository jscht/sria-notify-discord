import { CRAWL_MODE } from "../constants/crawlMode";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";
import { RecruitCacheService } from "./recruitCacheService";
import { CrawlService } from "./crawlService";
import { CityKo, CityEn } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";
import { cityNameConverter } from "../utils/cityName";
import { getCityFilteredList } from "../utils/getCityFilteredList";
import { HttpError } from "../utils/httpError";
import { isValidCityName } from "../utils/cityName";

/**
 * 사용자 요청 처리 흐름:
 * 1. Redis 캐시에서 공고 목록을 조회합니다.
 * 2. 캐시에 없으면 Firestore에서 조회합니다.
 * 3. 그래도 없으면 크롤링 요청을 수행합니다.
 * 4. 크롤링한 데이터를 Redis와 firestore에 저장합니다.
 *
 * @class RecruitService
 */
export class RecruitService {
  private readonly recruit_firestore: RecruitStore;
  private readonly recruitCacheService: RecruitCacheService;
  private readonly crawlService: CrawlService;

  constructor() {
    const { recruit, recruit_hash } = RedisManager.getInstance().store;
    this.recruit_firestore = new RecruitStore();
    this.recruitCacheService = new RecruitCacheService(recruit, recruit_hash);
    this.crawlService = new CrawlService();
  }

  async getRecruitList(mode: CRAWL_MODE, city?: string | undefined): Promise<ResponseRecruitData[] | null> {
    let convertedCity: CityKo | CityEn | undefined = undefined;
    if (mode === CRAWL_MODE.DUMMY) {
      convertedCity = cityNameConverter.toKorean(city) as CityKo;
    } else if (mode === CRAWL_MODE.CRAWL) {
      convertedCity = cityNameConverter.toEnglish(city) as CityEn;
    } else {
      throw HttpError.BadRequest("Invalid crawl mode.");
    }

    // 1. Check Redis Cache
    const cachedList = await this.recruitCacheService.getRecruitList(convertedCity as CityEn);
    if (cachedList) {
      return getCityFilteredList(mode, convertedCity, cachedList as ResponseRecruitData[]);
    }

    // 2. Check Firestore
    const firestoreData = await this.recruit_firestore.getRecruitList();
    if (firestoreData?.recruitList?.length > 0) {
      const list: ResponseRecruitData[] = firestoreData?.recruitList;

      // Cache update
      await this.recruitCacheService.setRecruitList(list);
      return getCityFilteredList(mode, convertedCity, list);
    }

    // 3. Request Crawling
    // 직접적인 크롤링 요청에 10분 제한(redis, firestore 둘 다 장애 시)
    const canRequest = await this.crawlService.isRequestAllowed();
    if (!canRequest) {
      throw HttpError.TooManyRequests("Crawling request limited.");
    }

    const crawledData = await this.collectAndSaveRecruits(mode, convertedCity as CityKo);
    if (!crawledData || crawledData instanceof Error) {
      throw HttpError.ServiceUnavailable(crawledData.message);
    }

    DebugLogger.server("Returning recruit list from crawler.");
    return getCityFilteredList(mode, convertedCity, crawledData);
  }

  private async collectAndSaveRecruits(mode: CRAWL_MODE, city?: CityKo) {
    const list = await this.crawlService.sriagent(mode, city);
    if (!Array.isArray(list) || list.length === 0) {
      return new Error("Invalid or empty result.");
    }

    await Promise.all([
      this.recruit_firestore.saveRecruitList(list),
      this.recruitCacheService.setRecruitList(list)
    ]);

    return list;
  }
}
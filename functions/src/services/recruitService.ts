import "@/common/utils/systemLogger";
import { CRAWL_MODE } from "@/common/constants";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";
import { RecruitCacheService, CrawlService } from "../services";
import { CityKo, CityEn } from "@/common/types";
import type { RecruitData } from "@/crawlers/types";
import type { RecruitTier } from "@/events/bus";
import { cityNameConverter } from "@/common/utils/cityName";
import { getCityFilteredList } from "@/common/utils";
import { HttpError } from "@/common/utils/httpError";

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
  private readonly cacheService: RecruitCacheService;
  private readonly firestore: RecruitStore;
  private readonly crawler: CrawlService;

  constructor() {
    const { recruit, recruit_hash } = RedisManager.getInstance().store;
    this.cacheService = new RecruitCacheService(recruit, recruit_hash);
    this.firestore = new RecruitStore();
    this.crawler = new CrawlService();
  }

  async getRecruitList(
    mode: CRAWL_MODE,
    city?: string
  ): Promise<{ data: RecruitData[] | null; tier: Exclude<RecruitTier, "error">; durationMs: number }> {
    const startedAt = Date.now();
    const convertedCity = this.convertCityByMode(mode, city);

    // Step 1: Redis Cache
    try {
      const cached = await this.cacheService.getRecruitList(convertedCity as CityEn);
      if (cached) {
        return { data: await getCityFilteredList(mode, convertedCity, cached), tier: "redis", durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      if (err instanceof Error) {
        globalLogger.error("get redis cache error:", err);
      }
      globalLogger.warn("Redis 장애 발생, Firestore로 fallback.");
    }

    // Step 2: Firestore
    try {
      const firestoreData = await this.firestore.getRecruitList();
      if (firestoreData) {
        // 캐시 백업 시도
        this.cacheService.setRecruitList(firestoreData).catch(() => {
          globalLogger.warn("캐시 저장 실패");
        });
        return { data: await getCityFilteredList(mode, convertedCity, firestoreData), tier: "firestore", durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      globalLogger.warn("Firestore 장애 발생, 크롤링으로 fallback.");
    }

    // Step 3: 크롤링 요청 제한 확인 (redis, firestore 둘 다 장애 시 / 10분 제한)
    const canRequest = await this.crawler.isRequestAllowed();
    if (!canRequest) {
      throw HttpError.TooManyRequests("Crawling request limited.");
    }

    // Step 4: 크롤링 실행
    const crawled = await this.collectAndSaveRecruits(mode, convertedCity as CityKo);
    if (!crawled) {
      return { data: null, tier: "empty", durationMs: Date.now() - startedAt };
    }

    globalLogger.info("Returning recruit list from crawler.");
    return { data: await getCityFilteredList(mode, convertedCity, crawled), tier: "crawler", durationMs: Date.now() - startedAt };
  }

  private async collectAndSaveRecruits(mode: CRAWL_MODE, city?: CityKo): Promise<RecruitData[] | null> {
    const list = await this.crawler.sriagent(mode, city);

    if (!Array.isArray(list) || list.length === 0) {
      globalLogger.warn("Invalid or empty result.");
      return null;
    }

    await Promise.all([
      this.firestore.saveRecruitList(list).catch(() => {
        globalLogger.warn("Firestore 저장 실패");
      }),
      this.cacheService.setRecruitList(list).catch(() => {
        globalLogger.warn("Redis 저장 실패");
      })
    ]);

    return list;
  }

  private convertCityByMode(mode: CRAWL_MODE, city?: string): CityKo | CityEn {
    switch (mode) {
      case CRAWL_MODE.DUMMY:
        return cityNameConverter.toKorean(city) as CityKo;
      case CRAWL_MODE.CRAWL:
        return cityNameConverter.toEnglish(city) as CityEn;
      default:
        throw HttpError.BadRequest("Invalid crawl mode.");
    }
  }
}

import "@/common/utils/systemLogger";
import { CRAWL_MODE } from "@/common/constants";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";
import { RecruitCacheService, CrawlService } from "../services";
import { CacheUpdateStatus } from "@/services/recruitCacheService";
import { CityKo, CityEn } from "@/common/types";
import type { RecruitData } from "@/crawlers/types";
import type { RecruitTier } from "@/events/bus";
import { emitRecruitChangedEvent, emitProxyUnavailable } from "@/events/bus";
import type { JobDiffResult } from "@/common/types/job.d";
import { cityNameConverter } from "@/common/utils/cityName";
import { getCityFilteredList } from "@/common/utils";
import { HttpError } from "@/common/utils/httpError";
import { crawlerLogger } from "@/common/utils/systemLogger";
import { ProxyExhaustedError } from "./errors";
import { proxyIncident } from "./proxyIncident";

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
        // 캐시 백업 시도 (CHANGED 시 RECRUIT_CHANGED 발행 — fire-and-forget)
        this.cacheService.setRecruitList(firestoreData)
          .then(({ status, diff }) => {
            if (status === CacheUpdateStatus.CHANGED) {
              void emitRecruitChangedEvent(diff, "RecruitService", { awaitSettle: false });
            }
          })
          .catch(() => {
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

    // Step 4: 크롤링 실행 (Phase 1.10: 프록시 소진 시 요청자에게만 503 — 전체 브로드캐스트 격리)
    let crawled: RecruitData[] | null;
    try {
      crawled = await this.collectAndSaveRecruits(mode, convertedCity as CityKo);
    } catch (error) {
      if (error instanceof ProxyExhaustedError) {
        throw HttpError.ServiceUnavailable(
          "최신 공고를 일시적으로 가져올 수 없습니다. 잠시 후 다시 시도해 주세요."
        );
      }
      throw error;
    }
    if (!crawled) {
      return { data: null, tier: "empty", durationMs: Date.now() - startedAt };
    }

    globalLogger.info("Returning recruit list from crawler.");
    return { data: await getCityFilteredList(mode, convertedCity, crawled), tier: "crawler", durationMs: Date.now() - startedAt };
  }

  /**
   * 스케줄러 전용 크롤→diff→(CHANGED시)RECRUIT_CHANGED 발행. getRecruitList 3-tier를 우회한다.
   * Redis 분산 락으로 사용자 백업 write와의 hash 경합(중복 emit)을 방지.
   * @param mode CRAWL_MODE (city 미지정 = 전체 지역 — 부분 스코프 결과를 diff에 넣지 않음)
   */
  async crawlAndDiff(mode: CRAWL_MODE): Promise<JobDiffResult> {
    const empty: JobDiffResult = { addedJobs: [], updatedJobs: [], deletedIds: [] };
    const LOCK_KEY = "lock:recruit:crawlAndDiff";
    const redis = RedisManager.getInstance();
    const token = await redis.acquireLock(LOCK_KEY, 60_000);
    if (!token) {
      globalLogger.warn("crawlAndDiff 락 획득 실패 — 다른 크롤 진행 중, 스킵");
      return empty;
    }
    try {
      let list: RecruitData[] | undefined;
      try {
        list = await this.crawler.sriagent(mode); // city 미지정 = 전체
      } catch (error) {
        if (error instanceof ProxyExhaustedError) {
          // 스케줄 갱신 실패 → 전체 구독자 staleness + 개발자 incident 알림.
          // tick은 정상 종료(throw 안 함 — 재시도 스톰·함수 에러 방지).
          await emitProxyUnavailable(
            error.reason,
            error.attempts,
            "RecruitService.crawlAndDiff",
            { awaitSettle: true },
            error.lastProxyIp
          );
          return empty;
        }
        throw error;
      }

      if (!list || list.length === 0) {
        globalLogger.warn("crawlAndDiff: 크롤 결과 없음 — setRecruitList 스킵(오삭제 방지)");
        return empty;
      }
      const { status, diff } = await this.cacheService.setRecruitList(list);

      // 성공: as-of 갱신 + incident 복구(RESOLVED 로그, 복구 DM 없음).
      await this.firestore.setLastRefreshedAt();
      const resolved = await proxyIncident.resolve();
      if (resolved) {
        crawlerLogger.warn("proxy incident RESOLVED", {
          incidentId: resolved.id,
          durationMs: resolved.durationMs,
        });
      }

      if (status === CacheUpdateStatus.CHANGED) {
        await emitRecruitChangedEvent(diff, "RecruitService.crawlAndDiff", { awaitSettle: true });
      }
      return diff;
    } finally {
      await redis.releaseLock(LOCK_KEY, token);
    }
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
      this.cacheService.setRecruitList(list)
        .then(({ status, diff }) => {
          if (status === CacheUpdateStatus.CHANGED) {
            void emitRecruitChangedEvent(diff, "RecruitService", { awaitSettle: false });
          }
        })
        .catch(() => {
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

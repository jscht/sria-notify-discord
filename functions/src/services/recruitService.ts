import "@/common/utils/systemLogger";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";
import { RecruitCacheService, RecruitSourceService } from "../services";
import { CacheUpdateStatus } from "@/services/recruitCacheService";
import type { Recruit, RecruitSource } from "@/common/types";
import type { RecruitTier } from "@/events/bus";
import { emitRecruitChangedEvent } from "@/events/bus";
import type { JobDiffResult } from "@/common/types/job.d";
import { filterListByCity } from "@/common/utils";
import { HttpError } from "@/common/utils/httpError";

/**
 * 사용자 요청 처리 흐름(3-tier):
 * 1. Redis 캐시 조회 → 2. Firestore 조회 → 3. 요청 제한 확인 → 4. 소스 프로바이더에서 수집·저장.
 *
 * Phase 1.10 재정의: 크롤러 대신 `RecruitSourceService`(사이트별 프로바이더 집계) 사용.
 * 스케줄 경로(`syncRecruits`)는 **소스별**로 수집·diff한다(사이트별 스케줄 지원).
 *
 * @class RecruitService
 */
export class RecruitService {
  private readonly cacheService: RecruitCacheService;
  private readonly firestore: RecruitStore;
  private readonly recruitSource: RecruitSourceService;

  constructor() {
    // eslint-disable-next-line camelcase -- store 레지스트리 속성명(Redis 서비스 키 관례)
    const { recruit, recruit_hash } = RedisManager.getInstance().store;
    this.cacheService = new RecruitCacheService(recruit, recruit_hash);
    this.firestore = new RecruitStore();
    this.recruitSource = new RecruitSourceService();
  }

  async getRecruitList(
    city?: string
  ): Promise<{ data: Recruit[] | null; tier: Exclude<RecruitTier, "error">; durationMs: number }> {
    const startedAt = Date.now();

    // Step 1: Redis Cache
    try {
      const cached = await this.cacheService.getRecruitList();
      if (cached) {
        return { data: filterListByCity(cached, city), tier: "redis", durationMs: Date.now() - startedAt };
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
        return { data: filterListByCity(firestoreData, city), tier: "firestore", durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      globalLogger.warn("Firestore 장애 발생, 소스 수집으로 fallback.");
    }

    // Step 3: 소스 수집 요청 제한 확인 (redis, firestore 둘 다 장애 시 / 10분 제한)
    const canRequest = await this.recruitSource.isRequestAllowed();
    if (!canRequest) {
      throw HttpError.TooManyRequests("Recruit source request limited.");
    }

    // Step 4: 소스 프로바이더에서 수집·저장
    const collected = await this.collectAndSaveRecruits();
    if (!collected) {
      return { data: null, tier: "empty", durationMs: Date.now() - startedAt };
    }

    globalLogger.info("Returning recruit list from source providers.");
    return { data: filterListByCity(collected, city), tier: "source", durationMs: Date.now() - startedAt };
  }

  /**
   * 스케줄러 전용 **소스별** 수집→diff→(CHANGED시)RECRUIT_CHANGED 발행. getRecruitList 3-tier를 우회.
   * 소스별 Redis 분산 락으로 사용자 백업 write와의 hash 경합(중복 emit)을 방지하되,
   * 다른 소스 스케줄과는 동시에 진행할 수 있다(락 키에 source 포함).
   */
  async syncRecruits(source: RecruitSource): Promise<JobDiffResult> {
    const empty: JobDiffResult = { addedJobs: [], updatedJobs: [], deletedIds: [] };
    const LOCK_KEY = `lock:recruit:sync:${source}`;
    const redis = RedisManager.getInstance();
    const token = await redis.acquireLock(LOCK_KEY, 60_000);
    if (!token) {
      globalLogger.warn(`syncRecruits(${source}) 락 획득 실패 — 다른 수집 진행 중, 스킵`);
      return empty;
    }
    try {
      const list = await this.recruitSource.fetchBySource(source);

      if (!list || list.length === 0) {
        globalLogger.warn(`syncRecruits(${source}): 수집 결과 없음 — setRecruitList 스킵(오삭제 방지)`);
        return empty;
      }
      const { status, diff } = await this.cacheService.setRecruitList(list, source);

      // 성공: as-of 갱신.
      await this.firestore.setLastRefreshedAt();

      if (status === CacheUpdateStatus.CHANGED) {
        await emitRecruitChangedEvent(diff, `RecruitService.syncRecruits:${source}`, { awaitSettle: true });
      }
      return diff;
    } finally {
      await redis.releaseLock(LOCK_KEY, token);
    }
  }

  private async collectAndSaveRecruits(): Promise<Recruit[] | null> {
    const list = await this.recruitSource.fetchAll();

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
        }),
    ]);

    return list;
  }
}

import "@/common/utils/systemLogger";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { redisKeyManager } from "../providers/redis/key";
import { RecruitStore } from "../providers/firebase/store";
import { RecruitCacheService, RecruitSourceService } from "../services";
import { CacheUpdateStatus } from "@/services/recruitCacheService";
import type { Recruit, RecruitSource } from "@/common/types";
import type { RecruitTier } from "@/events/bus";
import { emitRecruitChangedEvent } from "@/events/bus";
import type { JobDiffResult } from "@/common/types/job.d";
import { filterListByCity, SystemError } from "@/common/utils";
import { getAllProviders } from "@/providers/recruit";

/** 사이트 락 만료 시간. 락을 잡은 프로세스가 멈춰도 다음 갱신을 막지 않는다. */
const SYNC_LOCK_TTL_MS = 60_000;
/** 사이트 락 기본 대기 시간. 락 만료 시간과 같다. */
const DEFAULT_LOCK_WAIT_MS = 60_000;
/** 사이트 락을 다시 시도하는 간격. */
const LOCK_RETRY_INTERVAL_MS = 1_000;
/** 마지막 갱신 시각 키의 만료 시간. */
const LAST_SYNC_TTL_MS = 24 * 60 * 60_000;

/** `RecruitService`가 쓰는 객체. 테스트는 가짜를 넘긴다. */
export interface RecruitServiceDeps {
  redis: Pick<RedisManager, "acquireLock" | "releaseLock" | "getValue" | "setValue">;
  cacheService: RecruitCacheService;
  firestore: RecruitStore;
  recruitSource: RecruitSourceService;
  /** 사이트 락을 기다리는 최대 시간(ms). 기본 60초, 테스트만 10초 */
  lockWaitMs: number;
}

/** `syncRecruits` 옵션. 없으면 예약 실행되는 사이트 갱신과 같다. */
export interface SyncRecruitsOptions {
  /** 마지막 갱신 성공이 이 시간(ms) 안이면 갱신하지 않고 끝낸다 */
  skipIfSyncedWithinMs?: number;
  /** 사이트 락을 못 잡으면 건너뛰지 않고 풀릴 때까지 기다린다 */
  waitForLock?: boolean;
}

/**
 * 알림과 공고 조회가 쓰는 갱신 옵션.
 * 최근 5분 안에 갱신했으면 건너뛰고, 진행 중인 갱신은 끝날 때까지 기다린다.
 */
export const FRESH_SYNC_OPTIONS: SyncRecruitsOptions = {
  skipIfSyncedWithinMs: 5 * 60_000,
  waitForLock: true,
};

function createDefaultCacheService(): RecruitCacheService {
  // eslint-disable-next-line camelcase -- store 레지스트리 속성명(Redis 서비스 키 관례)
  const { recruit, recruit_hash } = RedisManager.getInstance().store;
  return new RecruitCacheService(recruit, recruit_hash);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 공고 조회와 사이트 갱신.
 *
 * 공고 조회(`getRecruitList`) 흐름:
 * 1. Redis 최신 공고 목록 → 2. 비어 있으면 사이트마다 `syncRecruits` → 3. Firestore 목록(읽기만).
 *
 * Redis 최신 공고 목록에 쓰는 곳은 `syncRecruits` 하나다. **소스별**로 수집·diff하므로
 * 사이트별 스케줄을 지원한다.
 *
 * @class RecruitService
 */
export class RecruitService {
  private readonly redis: RecruitServiceDeps["redis"];
  private readonly cacheService: RecruitCacheService;
  private readonly firestore: RecruitStore;
  private readonly recruitSource: RecruitSourceService;
  private readonly lockWaitMs: number;

  /** 넘기지 않은 항목만 만든다. 가짜를 모두 넘기면 Redis·Firebase 초기화가 필요 없다. */
  constructor(deps: Partial<RecruitServiceDeps> = {}) {
    this.redis = deps.redis ?? RedisManager.getInstance();
    this.cacheService = deps.cacheService ?? createDefaultCacheService();
    this.firestore = deps.firestore ?? new RecruitStore();
    this.recruitSource = deps.recruitSource ?? new RecruitSourceService();
    this.lockWaitMs = deps.lockWaitMs ?? DEFAULT_LOCK_WAIT_MS;
  }

  /**
   * 공고 목록을 조회한다.
   *
   * Redis가 비면 사이트 갱신과 같은 `syncRecruits`로 채운다. Firestore 목록은 보여 주기만 하고
   * Redis에 쓰지 않는다. 오래된 목록이 Redis에 섞이지 않게 하기 위해서다.
   *
   * @param city 한글 지명. 없으면 전체
   * @returns 공고 목록과 어디서 읽었는지(`tier`)
   */
  async getRecruitList(
    city?: string
  ): Promise<{ data: Recruit[] | null; tier: Exclude<RecruitTier, "error">; durationMs: number }> {
    const startedAt = Date.now();
    const done = (data: Recruit[] | null, tier: Exclude<RecruitTier, "error">) =>
      ({ data: data && filterListByCity(data, city), tier, durationMs: Date.now() - startedAt });

    // 1. Redis
    const cached = await this.readRedis();
    if (cached) return done(cached, "redis");

    // 2. 사이트 갱신과 같은 함수로 채운다 (락·사이트 구분·마지막 갱신 시각을 그대로 따른다)
    await Promise.allSettled(
      getAllProviders().map(({ source }) => this.syncRecruits(source, FRESH_SYNC_OPTIONS))
    );
    const synced = await this.readRedis();
    if (synced) return done(synced, "source");

    // 3. Firestore는 보여 주기만 한다
    const backup = await this.firestore.getRecruitList().catch(() => null);
    if (backup?.length) return done(backup, "firestore");

    return done(null, "empty");
  }

  /**
   * **소스별** 수집→diff→(CHANGED시)RECRUIT_CHANGED 발행.
   *
   * 소스별 Redis 분산 락으로 다른 갱신과의 hash 경합(중복 emit)을 방지하되,
   * 다른 소스와는 동시에 진행할 수 있다(락 키에 source 포함).
   * 사이트가 정말 0건이면 그 사이트 공고를 Redis에서 지운다(design §2.12).
   *
   * 마지막 갱신 시각은 성공했을 때만, 락을 풀기 전에 저장한다. 락을 먼저 풀면 기다리던 쪽이
   * 그 사이에 락을 잡고 옛 시각을 읽어 같은 갱신을 한 번 더 한다.
   *
   * @param source 갱신할 사이트
   * @param options 건너뛰기·락 대기 옵션
   * @returns 바뀐 내용. 건너뛰었으면 빈 결과
   * @throws {SystemError} `waitForLock`인데 대기 시간 안에 락을 못 잡았을 때
   */
  async syncRecruits(
    source: RecruitSource,
    options: SyncRecruitsOptions = {}
  ): Promise<JobDiffResult> {
    const empty: JobDiffResult = { addedJobs: [], updatedJobs: [], deletedIds: [] };
    const { skipIfSyncedWithinMs, waitForLock } = options;

    if (await this.isSyncedWithin(source, skipIfSyncedWithinMs)) return empty;

    const lockKey = `lock:recruit:sync:${source}`;
    let token = await this.redis.acquireLock(lockKey, SYNC_LOCK_TTL_MS);
    if (!token && !waitForLock) {
      globalLogger.warn(`syncRecruits(${source}) 락 획득 실패 — 다른 수집 진행 중, 스킵`);
      return empty;
    }
    if (!token) {
      token = await this.waitForSyncLock(lockKey, source, skipIfSyncedWithinMs);
      if (!token) return empty; // 앞 갱신이 방금 성공했으므로 다시 가져올 필요가 없다
    }

    try {
      const list = await this.recruitSource.fetchBySource(source);
      const { status, diff } = await this.cacheService.setRecruitList(list, source);

      if (list.length === 0 && diff.deletedIds.length > 0) {
        globalLogger.warn(`syncRecruits(${source}): 공고 0건 — 이전 ${diff.deletedIds.length}건을 지움`);
      }

      // 성공: as-of 갱신.
      await this.firestore.setLastRefreshedAt();
      await this.redis.setValue(this.lastSyncKey(source), String(Date.now()), LAST_SYNC_TTL_MS);

      if (status === CacheUpdateStatus.CHANGED) {
        await emitRecruitChangedEvent(diff, `RecruitService.syncRecruits:${source}`, { awaitSettle: true });
      }
      return diff;
    } finally {
      await this.redis.releaseLock(lockKey, token);
    }
  }

  /** Redis 최신 공고 목록을 읽는다. 장애면 로그를 남기고 null. */
  private async readRedis(): Promise<Recruit[] | null> {
    try {
      return await this.cacheService.getRecruitList();
    } catch (err) {
      if (err instanceof Error) {
        globalLogger.error("get redis cache error:", err);
      }
      globalLogger.warn("Redis 장애 발생, 다음 단계로 진행.");
      return null;
    }
  }

  private lastSyncKey(source: RecruitSource): string {
    return redisKeyManager.recruit.getKeys().lastSync(source);
  }

  /** 마지막 갱신 성공이 주어진 시간 안인지 확인한다. 시간을 주지 않으면 항상 false. */
  private async isSyncedWithin(source: RecruitSource, withinMs?: number): Promise<boolean> {
    if (withinMs === undefined) return false;
    const lastSync = await this.redis.getValue(this.lastSyncKey(source));
    return lastSync !== null && Date.now() - Number(lastSync) < withinMs;
  }

  /**
   * 사이트 락이 풀릴 때까지 1초 간격으로 다시 시도한다.
   *
   * 다시 시도할 때마다 마지막 갱신 시각을 먼저 본다. 앞 갱신이 방금 성공했으면 락을 잡지 않는다.
   *
   * @returns 락 토큰. 앞 갱신이 방금 성공했으면 null
   * @throws {SystemError} 대기 시간 안에 락을 못 잡았을 때
   */
  private async waitForSyncLock(
    lockKey: string,
    source: RecruitSource,
    skipIfSyncedWithinMs?: number
  ): Promise<string | null> {
    const deadline = Date.now() + this.lockWaitMs;
    while (Date.now() < deadline) {
      await sleep(LOCK_RETRY_INTERVAL_MS);
      if (await this.isSyncedWithin(source, skipIfSyncedWithinMs)) return null;
      const token = await this.redis.acquireLock(lockKey, SYNC_LOCK_TTL_MS);
      if (token) return token;
    }
    throw SystemError.timeoutError(`syncRecruits(${source}) 락 대기 시간 초과`, {
      source,
      lockWaitMs: this.lockWaitMs,
    });
  }
}

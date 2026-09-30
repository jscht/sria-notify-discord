import crypto from "node:crypto";
import { RecruitCacheStore, RecruitHashStore } from "../providers/redis/store";
import type { Job, HashedString, JobDiffResult, JobHashes } from "@/common/types/job.d";
import type { Recruit, RecruitSource } from "@/common/types";

/**
 * 공고 캐시 갱신 결과 상태
 */
export enum CacheUpdateStatus {
  NO_DATA = "NO_DATA",
  UNCHANGED = "UNCHANGED",
  CHANGED = "CHANGED",
}

/**
 * 공고 리스트 갱신 흐름:
 * - 기존 해시 목록을 Redis에서 조회합니다.
 * - 신규 데이터를 받아 각 항목의 해시 값을 생성합니다.
 * - 기존 해시와 신규 해시를 비교하여 변경 여부를 판단합니다.
 * - 변경된 데이터만 Redis에 저장하거나 삭제합니다.
 * - 변경 사항이 없을 경우 캐시 만료 시간만 갱신합니다.
 *
 * Phase 1.10 재정의: `id`는 소스 제공 식별자(`"{source}:{localId}"`)를 그대로 사용한다.
 * `source`를 넘기면 diff를 **그 소스 파티션**(id 접두사 `"{source}:"`)으로만 한정 →
 * 사이트별 스케줄이 서로의 공고를 삭제로 오탐하지 않는다.
 *
 * @class RecruitCacheService
 */
export class RecruitCacheService {
  constructor(
    private readonly cacheStore: RecruitCacheStore,
    private readonly hashStore: RecruitHashStore
  ) {}

  /** 전체 공고 조회. 도시 필터링은 호출 측(`filterListByCity`)에서 수행. */
  async getRecruitList(): Promise<Recruit[] | null> {
    return this.cacheStore.getAll();
  }

  async setRecruitList(
    list: Recruit[],
    source?: RecruitSource
  ): Promise<{ status: CacheUpdateStatus; diff: JobDiffResult }> {
    const expiration = 6 * 60 * 60; // 6시간
    const newJobs = this.mapToJob(list);
    const newHashes = this.createHashes(newJobs);

    // 소스 지정 시 diff 기준선을 그 소스 파티션으로만 한정.
    const allCurrent = await this.hashStore.getAll();
    const currentHashes: JobHashes | null =
      source && allCurrent
        ? Object.fromEntries(
            Object.entries(allCurrent).filter(([id]) => id.startsWith(`${source}:`))
          )
        : allCurrent;

    const baselineExists = !!currentHashes && Object.keys(currentHashes).length > 0;

    let status: CacheUpdateStatus;
    let diffJobs: JobDiffResult = {
      addedJobs: [],
      updatedJobs: [],
      deletedIds: [],
    };

    if (!baselineExists) {
      status = CacheUpdateStatus.NO_DATA;
    } else {
      diffJobs = this.diffJobs(newJobs, newHashes, currentHashes as JobHashes);
      const { addedJobs, updatedJobs, deletedIds } = diffJobs;
      status = addedJobs.length || updatedJobs.length || deletedIds.length
        ? CacheUpdateStatus.CHANGED
        : CacheUpdateStatus.UNCHANGED;
    }

    switch (status) {
      case CacheUpdateStatus.NO_DATA:
        await this.saveAll(newJobs, newHashes, expiration);
        // NOTE: 기준선 부재로 diff 비교 불가 → RECRUIT_CHANGED 미발행(의도된 동작).
        globalLogger.warn(
          `No baseline${source ? ` for '${source}'` : ""}. Cached (6h). (기준선 부재로 RECRUIT_CHANGED 미발행)`
        );
        break;

      case CacheUpdateStatus.CHANGED: {
        const { addedJobs, updatedJobs, deletedIds } = diffJobs;
        await this.syncChanges(addedJobs, updatedJobs, deletedIds, newHashes, expiration);
        globalLogger.info(
          `Redis cache updated${source ? ` [${source}]` : ""}. added: ${addedJobs.length}, deleted: ${deletedIds.length}, updated: ${updatedJobs.length}`
        );
        break;
      }

      case CacheUpdateStatus.UNCHANGED:
        await this.extendExpiration(expiration);
        globalLogger.info("No changes. Expiration extended.");
        break;
    }

    return { status, diff: diffJobs };
  }

  private createHashes(jobs: Job[]): JobHashes {
    const hashObject = (obj: unknown): HashedString =>
      crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");

    return jobs.reduce<JobHashes>((acc, job) => {
      acc[job.id] = hashObject(job.value);
      return acc;
    }, {});
  }

  /**
   * Recruit 배열을 Job 배열로 변환.
   * @description Job.id는 소스가 제공한 `id`(`"{source}:{localId}"`)를 그대로 사용.
   */
  private mapToJob(list: Recruit[]): Job[] {
    return list.map((job) => ({
      id: job.id,
      value: job,
    }));
  }

  private async saveAll(jobs: Job[], hashes: JobHashes, expiration: number) {
    for (const job of jobs) {
      await this.cacheStore.save(job.id, job.value, expiration);
      await this.hashStore.save(job.id, hashes[job.id], expiration);
    }
  }

  private diffJobs(
    newJobs: Job[],
    newHashes: JobHashes,
    currentHashes: JobHashes
  ) {
    const addedJobs: Job[] = [];
    const updatedJobs: Job[] = [];
    const currentIds = new Set(Object.keys(currentHashes));
    const newIds = new Set(Object.keys(newHashes));

    for (const job of newJobs) {
      const currentHash = currentHashes[job.id];
      const newHash = newHashes[job.id];

      if (!currentHash) addedJobs.push(job);
      else if (currentHash !== newHash) updatedJobs.push(job);
    }

    const deletedIds = Array.from(currentIds).filter((id) => !newIds.has(id));
    return { addedJobs, updatedJobs, deletedIds };
  }

  private async syncChanges(
    added: Job[],
    updated: Job[],
    deleted: string[],
    hashes: JobHashes,
    expiration: number
  ) {
    const jobsToSave = [...added, ...updated];
    for (const job of jobsToSave) {
      await this.cacheStore.save(job.id, job.value, expiration);
      await this.hashStore.save(job.id, hashes[job.id], expiration);
    }
    for (const id of deleted) {
      await this.cacheStore.delete(id);
      await this.hashStore.delete(id);
    }
  }

  private async extendExpiration(expiration: number) {
    await this.cacheStore.expire(expiration);
    await this.hashStore.expire(expiration);
  }
}

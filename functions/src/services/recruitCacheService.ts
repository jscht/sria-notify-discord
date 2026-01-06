import crypto from "crypto";
import { RecruitCacheStore, RecruitHashStore } from "../providers/redis/store";
import type { CityEn } from "@/common/types/city.d";
import type { Job, HashedString, JobDiffResult, JobHashes } from "@/common/types/recruitCache.d";
import type { RecruitData } from "@/crawlers/types";

/**
 * 공고 리스트 갱신 흐름:
 * - 기존 해시 목록을 Redis에서 조회합니다.
 * - 신규 데이터를 받아 각 항목의 해시 값을 생성합니다.
 * - 기존 해시와 신규 해시를 비교하여 변경 여부를 판단합니다.
 * - 변경된 데이터만 Redis에 저장하거나 삭제합니다.
 * - 변경 사항이 없을 경우 캐시 만료 시간만 갱신합니다.
 *
 * @class RecruitCacheService
 */
export class RecruitCacheService {
  constructor(
    private readonly cacheStore: RecruitCacheStore,
    private readonly hashStore: RecruitHashStore
  ) {}

  async getRecruitList(city?: CityEn): Promise<RecruitData[] | null> {
    return city
      ? await this.cacheStore.getByCity(city)
      : await this.cacheStore.getAll();
  }

  async setRecruitList(list: RecruitData[]) {
    enum CacheUpdateStatus {
      NO_DATA = "NO_DATA",
      UNCHANGED = "UNCHANGED",
      CHANGED = "CHANGED"
    };

    const expiration = 6 * 60 * 60;  // 6시간
    const newJobs = this.mapToJob(list);
    const newHashes = this.createHashes(newJobs);
    const currentHashes = await this.hashStore.getAll();

    let status: CacheUpdateStatus;
    let diffJobs: JobDiffResult = {
      addedJobs: [],
      updatedJobs: [],
      deletedIds: [],
    };

    if (!currentHashes) {
      status = CacheUpdateStatus.NO_DATA;
    } else {
      // 데이터 변경점 비교
      diffJobs = this.diffJobs(newJobs, newHashes, currentHashes);
      const { addedJobs, updatedJobs, deletedIds } = diffJobs;

      status = addedJobs.length || updatedJobs.length || deletedIds.length
        ? CacheUpdateStatus.CHANGED
        : CacheUpdateStatus.UNCHANGED;
    }

    switch (status) {
      case CacheUpdateStatus.NO_DATA:
        await this.saveAll(newJobs, newHashes, expiration);
        DebugLogger.server("No data found. Data cached successfully and expiry of 6 hours.");
        break;

      case CacheUpdateStatus.CHANGED:
        const { addedJobs, updatedJobs, deletedIds } = diffJobs;
        await this.syncChanges(addedJobs, updatedJobs, deletedIds, newHashes, expiration);
        DebugLogger.server(`
          Redis cache updated.\n
          added: ${addedJobs.length}, deleted: ${deletedIds.length}, updated: ${updatedJobs.length}
        `);
        break;

      case CacheUpdateStatus.UNCHANGED:
        await this.extendExpiration(expiration);
        DebugLogger.server("No changes. Expiration extended.");
        break;
    }
  }

  private createHashes(jobs: Job[]): JobHashes {
    const hashObject = (obj: any): HashedString =>
      crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");

    return jobs.reduce<JobHashes>((acc, job) => {
      acc[job.id] = hashObject(job.value);
      return acc;
    }, {});
  }

  private mapToJob(list: RecruitData[]): Job[] {
    const extractId = (href: string): string => href.replace("/jobs/", "");

    return list.map((job) => ({
      id: extractId(job.href),
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

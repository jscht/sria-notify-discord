import crypto from "crypto";
import { RecruitCacheStore, RecruitHashStore } from "../providers/redis/store";
import { CityEn } from "../types/city";
import { ResponseRecruitData } from "../types/responseRecruitData";

interface Job {
  id: string;
  value: ResponseRecruitData;
}

type HashedString = string;
type JobHashes = Record<string, HashedString>;

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

  private hashObject(obj: any) {
    return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
  }

  private extractId(href: string) {
    return href.replace("/jobs/", "");
  }

  private mapToJob(list: ResponseRecruitData[]): Job[] {
    return list.map((job) => ({
      id: this.extractId(job.href),
      value: job,
    }));
  }

  async getRecruitList(city?: CityEn): Promise<ResponseRecruitData[] | null> {
    return city
      ? await this.cacheStore.getByCity(city)
      : await this.cacheStore.getAll();
  }

  async setRecruitList(list: ResponseRecruitData[]) {
    enum DataChangeStatus {
      NO_DATA = "NO_DATA",
      NO_CHANGES = "NO_CHANGES",
      DATA_CHANGED = "DATA_CHANGED",
    };

    const { NO_DATA, NO_CHANGES, DATA_CHANGED } = DataChangeStatus;
    let changeStatus = NO_CHANGES;

    const expirationTimeInSeconds = 6 * 60 * 60; // 6시간

    const newData = this.mapToJob(list);

    // 새 데이터의 해시 계산
    const newHashes = newData.reduce<JobHashes>((acc, job) => {
      acc[job.id] = this.hashObject(job.value);
      return acc;
    }, {});

    // Redis에서 현재 저장된 해시 값 가져오기
    const currentHash = await this.hashStore.getAll();

    if (!currentHash) {
      // 레디스에 저장된 데이터가 없음 -> 수정 여부 확인 건너뛰고 저장 필요
      changeStatus = NO_DATA;

      for (const job of newData) {
        await this.cacheStore.save(job.id, job.value, expirationTimeInSeconds);
        await this.hashStore.save(job.id, newHashes[job.id], expirationTimeInSeconds);
      }
      DebugLogger.server("No data found. Data cached successfully and expiry of 6 hours.");
      return;
    }

    // 새 데이터의 ID와 기존 데이터의 ID 비교
    const currentIdSet = new Set(Object.keys(currentHash));
    const newIdSet = new Set(Object.keys(newHashes));

    // 추가, 삭제 데이터
    const addedJobs = newData.filter((job) => !currentIdSet.has(this.extractId(job.id)));
    const deletedIds = Array.from(currentIdSet).filter((id) => !newIdSet.has(id));

    // 수정된 데이터 (해시 비교)
    const updatedJobs = newData.filter((job) => {
      const current = currentHash[job.id];
      const next = newHashes[job.id];
      return !current || this.hashObject(current) !== next;
    });

    if (addedJobs.length || deletedIds.length || updatedJobs.length) {
      // 기존 캐시와의 변경점이 있음 -> 캐시 수정 필요
      changeStatus = DATA_CHANGED;

      DebugLogger.server(`
        added: ${addedJobs.length}\n
        deleted: ${deletedIds.length}\n
        updated: ${updatedJobs.length}
      `);
    }

    if (changeStatus === DATA_CHANGED) {
      for (const job of addedJobs) {
        await this.cacheStore.save(job.id, job.value, expirationTimeInSeconds);
        await this.hashStore.save(job.id, newHashes[job.id], expirationTimeInSeconds);
      }

      for (const id of deletedIds) {
        await this.cacheStore.delete(id);
        await this.hashStore.delete(id);
      }

      for (const job of updatedJobs) {
        await this.cacheStore.save(job.id, job.value, expirationTimeInSeconds);
        await this.hashStore.save(job.id, newHashes[job.id], expirationTimeInSeconds);
      }
      DebugLogger.server("Redis cache updated.");
    } else {
      await this.cacheStore.expire(expirationTimeInSeconds);
      await this.hashStore.expire(expirationTimeInSeconds);
      DebugLogger.server("No changes. Expiration extended.");
    }
  }
}
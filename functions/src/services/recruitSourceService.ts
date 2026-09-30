import "@/common/utils/systemLogger";
import type { Recruit, RecruitSource } from "@/common/types";
import { RedisManager } from "@/providers/redis/manager/redisManager";
import { RequestLimitStore } from "@/providers/redis/store";
import { getAllProviders, getProvider, type RecruitProvider } from "@/providers/recruit";

/**
 * 공고 소스 집계 서비스. (Phase 1.10 — 구 CrawlService 대체)
 *
 * - `fetchAll`: 전체 소스 병합(읽기 경로용) — allSettled·소스별 실패 격리·id 중복제거.
 * - `fetchBySource`: 한 소스만(소스별 스케줄러용).
 * - 요청 제한(10분 쿨다운)은 기존 RequestLimitStore 그대로 승계.
 */
export class RecruitSourceService {
  private readonly requestLimitStore: RequestLimitStore;
  private readonly providers: RecruitProvider[];

  constructor(providers?: RecruitProvider[]) {
    this.requestLimitStore = RedisManager.getInstance().store.requestLimit;
    this.providers = providers ?? getAllProviders();
  }

  /** 모든 소스 병합(읽기 경로). 프로바이더별 실패는 경고 로그로 격리. */
  async fetchAll(): Promise<Recruit[]> {
    const results = await Promise.allSettled(this.providers.map((p) => p.fetch()));

    const merged: Recruit[] = [];
    results.forEach((result, i) => {
      const source = this.providers[i].source;
      if (result.status === "fulfilled") {
        globalLogger.info(`[RecruitSource] '${source}' → ${result.value.length}건`);
        merged.push(...result.value);
      } else {
        globalLogger.warn(`[RecruitSource] '${source}' 실패(격리): ${result.reason}`);
      }
    });

    return this.dedupeById(merged);
  }

  /** 단일 소스만 수집(소스별 스케줄 sync용). 프로바이더 없으면 빈 배열. */
  async fetchBySource(source: RecruitSource): Promise<Recruit[]> {
    const provider = getProvider(source);
    if (!provider) {
      globalLogger.warn(`[RecruitSource] provider 없음: ${source}`);
      return [];
    }
    const list = await provider.fetch();
    globalLogger.info(`[RecruitSource] '${source}' → ${list.length}건`);
    return this.dedupeById(list);
  }

  /** id 기준 중복제거 — 먼저 등장한 항목 유지. */
  private dedupeById(list: Recruit[]): Recruit[] {
    const seen = new Set<string>();
    const unique: Recruit[] = [];
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }
    return unique;
  }

  /** 요청 제한(10분 쿨다운) 확인 — 기존 동작 유지. */
  async isRequestAllowed(): Promise<boolean> {
    const limited = await this.requestLimitStore.isRequestLimitSet();
    if (!limited) {
      await this.requestLimitStore.setRequestLimit();
    }
    return !limited;
  }
}

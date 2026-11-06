import "@/common/utils/systemLogger";
import type { Recruit, RecruitSource } from "@/common/types";
import { SystemError } from "@/common/utils";
import { getProvider } from "@/providers/recruit";

/**
 * 공고 소스 수집 서비스. (Phase 1.10 — 구 CrawlService 대체)
 *
 * `fetchBySource`로 한 소스만 수집한다. 모든 수집은 `RecruitService.syncRecruits`를 거친다.
 */
export class RecruitSourceService {
  /**
   * 단일 소스만 수집한다.
   *
   * 사이트 설정이 없으면 빈 목록 대신 오류를 낸다. 빈 목록은 "정말 0건"으로 처리되어
   * 설정 실수로 그 사이트 공고가 전부 지워지기 때문이다(design §2.12).
   *
   * @throws {SystemError} 사이트 설정이 없을 때
   */
  async fetchBySource(source: RecruitSource): Promise<Recruit[]> {
    const provider = getProvider(source);
    if (!provider) {
      throw SystemError.validationError(`[RecruitSource] provider 없음: ${source}`, { source });
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
}

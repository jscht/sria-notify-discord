import crypto from "node:crypto";
import type { JobHashes, Recruit } from "@/common/types";

/**
 * 공고별 비교값을 계산한다 (Pure Function)
 *
 * 비교값은 공고 JSON의 sha256이다. 최신 공고 목록 비교(`RecruitCacheService`)와
 * 지난 알림 때 목록 비교가 같은 계산을 쓴다.
 *
 * @param recruits 공고 목록
 * @returns 공고 ID → 비교값
 */
export function hashRecruits(recruits: Recruit[]): JobHashes {
  return recruits.reduce<JobHashes>((acc, recruit) => {
    acc[recruit.id] = crypto.createHash("sha256").update(JSON.stringify(recruit)).digest("hex");
    return acc;
  }, {});
}

/**
 * Recruit Cache Type Definitions
 */

import type { RecruitData } from "@/crawlers/types";

export interface Job {
  /**
   * 공고 고유 ID
   * @description RecruitCacheService.mapToJob()에서 RecruitData.href로부터 추출됨
   * @example href="/jobs/12345" → id="12345"
   */
  id: string;
  /**
   * 공고 상세 데이터
   * @description 크롤러에서 수집한 원본 공고 정보
   */
  value: RecruitData;
}

export type HashedString = string;
export type JobHashes = Record<string, HashedString>;

export interface JobDiffResult {
  addedJobs: Job[];
  updatedJobs: Job[];
  deletedIds: string[];
}

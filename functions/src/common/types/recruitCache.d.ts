/**
 * Recruit Cache Type Definitions
 */

import type { RecruitData } from "@/crawlers/types";

export interface Job {
  id: string;
  value: RecruitData;
}

export type HashedString = string;
export type JobHashes = Record<string, HashedString>;

export interface JobDiffResult {
  addedJobs: Job[];
  updatedJobs: Job[];
  deletedIds: string[];
}

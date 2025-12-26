/**
 * Recruit Cache Type Definitions
 */

import type { ResponseRecruitData } from "./responseRecruitData.d";

export interface Job {
  id: string;
  value: ResponseRecruitData;
}

export type HashedString = string;
export type JobHashes = Record<string, HashedString>;

export interface JobDiffResult {
  addedJobs: Job[];
  updatedJobs: Job[];
  deletedIds: string[];
}

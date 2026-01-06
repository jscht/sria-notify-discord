/**
 * Crawler Type Definitions
 */

import type { RecruitData, ProxyDoc } from "@/crawlers/types";

export type Crawler = {
  sriagent: () => Promise<RecruitData[]>;
  proxy: () => Promise<ProxyDoc[]>;
};

export type Scheduler = {
  sriagent: () => Promise<void>;
};

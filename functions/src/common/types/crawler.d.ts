/**
 * Crawler Type Definitions
 */

import type { ProxyDoc } from "./proxyData.d";
import type { ResponseRecruitData } from "./responseRecruitData.d";

export type Crawler = {
  sriagent: () => Promise<ResponseRecruitData[]>;
  proxy: () => Promise<ProxyDoc[]>;
};

export type Scheduler = {
  sriagent: () => Promise<void>;
};

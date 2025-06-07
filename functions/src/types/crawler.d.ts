import { ProxyDoc } from "./proxyData.d";
import { ResponseRecruitData } from "./responseRecruitData.d";

export type Crawler = {
  sriagent: () => Promise<ResponseRecruitData[]>;
  proxy: () => Promise<ProxyDoc[]>;
};

export type Scheduler = {
  sriagent: () => Promise<void>;
};
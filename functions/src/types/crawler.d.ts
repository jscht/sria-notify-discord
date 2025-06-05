import { ProxyDoc } from "./proxyData.d";
import { ResponseRecruitData } from "./responseRecruitData.d";

export type CrawlerMap = {
  sriagent: () => Promise<ResponseRecruitData[]>;
  proxy: () => Promise<ProxyDoc[]>;
};

export type SchedulerMap = {
  sriagent: () => Promise<void>;
};
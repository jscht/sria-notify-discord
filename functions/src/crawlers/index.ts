import { recruitScraper, runRecruitScheduler } from "./sriagent";
import { proxyScraper } from "./proxy";
import { Crawler, Scheduler } from "../types/crawler";

export const crawler: Crawler = {
  sriagent: recruitScraper,
  proxy: proxyScraper,
};

export const scheduler: Scheduler = {
  sriagent: runRecruitScheduler,
};
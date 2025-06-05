import { recruitScraper, runRecruitScheduler } from "./sriagent";
import { proxyScraper } from "./proxy";
import { CrawlerMap, SchedulerMap } from "../types/crawler";

export const crawlers: CrawlerMap = {
  sriagent: recruitScraper,
  proxy: proxyScraper,
};

export const scheduler: SchedulerMap = {
  sriagent: runRecruitScheduler
}
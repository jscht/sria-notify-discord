import { Router } from "express";
import { CRAWL_MODE } from "../constants/crawlMode";
import { RecruitService } from "../services/recruitService";
import { CrawlService } from "../services/crawlService";
import { scanKeys } from "../providers/redis/client/scanKeys";
import { SERVICE_NAME } from "../providers/redis/constants/serviceName";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { ProxyStore, RecruitStore } from "../providers/firebase/store";

const testRouter = Router();

testRouter.get("/recruit", async (req, res, next) => {
  try {
    const { city } = req.query;

    const recruitService = new RecruitService();
    const recruitList = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, city);

    const logMessage = !city
      ? "/recruit 정상 처리"
      : `/recruit/?city=${city} 정상 처리`;
    DebugLogger.server(logMessage);

    res.status(200).json({ message: "정상 처리", result: recruitList });
  } catch (error) {
    next(error);
  }
});

testRouter.get("/redis-stores", async (req, res) => {
  const pattern = SERVICE_NAME.RECRUIT + "*";

  const keys: string[] = await scanKeys(pattern);
  DebugLogger.request(`🚀 ~ testRouter.get ~ found keys: ${keys.length}`);
  
  const redisValues: Record<string, any> = {};
  const recruit_cacheStore = RedisManager.getInstance().store.recruit;

  for (const key of keys) {
    try {
      redisValues[key] = await recruit_cacheStore.getDataByKeyFromCache(key);
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error(`Error fetching key "${key}" from Redis:`, error);
      }
      redisValues[key] = null; // 에러 발생 시 null로 저장
    }
  }

  res.json({ result: redisValues });
});

testRouter.get("/firestore-recruit", async (req, res) => {
  const recruit_firestore = new RecruitStore();
  const result = await recruit_firestore.getRecruitList();

  res.json({ result });
});

testRouter.get("/firestore-proxy", async (req, res) => {
  const proxy_firestore = new ProxyStore();
  const result = await proxy_firestore.getProxyList();

  res.json({ result });
});

testRouter.get("/playwright-scraper", async (req, res) => {
  const mode = req.query.mode || "dummy";
  const scrapMode = mode === "crawl" ? CRAWL_MODE.CRAWL : CRAWL_MODE.DUMMY;
  DebugLogger.server(`route /playwright-scraper with mode: ${scrapMode}`);

  const crawlService = new CrawlService();
  const crawlData = await crawlService.sriagent(scrapMode);
  let result = null;

  result = !crawlData ? crawlData : "No recruitment data";
  res.json({ result });
});

testRouter.get("/proxy-scraper", async (req, res) => {
  const crawlService = new CrawlService();
  const result = await crawlService.proxy();

  const proxy_firestore = new ProxyStore();
  proxy_firestore.saveProxyList(result);

  res.json({ result });
});

testRouter.get("/discord", async (req, res) => {
  
});

export { testRouter };
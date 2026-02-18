import "@/common/utils/systemLogger";
import { Router } from "express";
import { CRAWL_MODE } from "../constants/crawlMode";
import { RecruitService, CrawlService } from "../services";
import { scanKeys } from "../providers/redis/client/scanKeys";
import { SERVICE_NAME } from "../providers/redis/constants/serviceName";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { ProxyStore, RecruitStore } from "../providers/firebase/store";

const testRouter = Router();

// OK
testRouter.get("/recruit", async (req, res, next) => {
  try {
    const { city } = req.query;

    const recruitService = new RecruitService();
    const recruitList = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, city as string | undefined);

    const logMessage = `${!city ? "전체" : city} 지역 공고 정상 반환`;
    globalLogger.info(logMessage);

    res.status(200).json({ message: logMessage, result: recruitList });
  } catch (error) {
    next(error);
  }
});

// OK
testRouter.get("/redis-stores", async (req, res) => {
  const pattern = SERVICE_NAME.RECRUIT + "*";

  const keys: string[] = await scanKeys(pattern);
  globalLogger.info(`🚀 ~ testRouter.get ~ found keys: ${keys.length}`);
  
  const redisValues: Record<string, any> = {};
  const recruit_cacheStore = RedisManager.getInstance().store.recruit;

  for (const key of keys) {
    try {
      redisValues[key] = await recruit_cacheStore.getDataByKeyFromCache(key);
    } catch (error) {
      if (error instanceof Error) {
        globalLogger.error(`Error fetching key "${key}" from Redis:`, error);
      }
      redisValues[key] = null; // 에러 발생 시 null로 저장
    }
  }

  res.json({ result: redisValues });
});

// OK
testRouter.get("/firestore-recruit", async (req, res) => {
  const recruit_firestore = new RecruitStore();
  const result = await recruit_firestore.getRecruitList();

  res.json({ result });
});

// OK
testRouter.get("/firestore-proxy", async (req, res) => {
  const proxy_firestore = new ProxyStore();
  const result = await proxy_firestore.getProxyList();

  res.json({ result });
});

// 최근 갱신 시각이 1시간 이내일 시 건너뛰기 firestore에 갱신 시간 기록
testRouter.get("/playwright-scraper", async (req, res) => {
  const mode = req.query.mode || "dummy";
  const scrapMode = mode === "crawl" ? CRAWL_MODE.CRAWL : CRAWL_MODE.DUMMY;
  globalLogger.info(`route /playwright-scraper with mode: ${scrapMode}`);

  const crawlService = new CrawlService();
  const crawlData = await crawlService.sriagent(scrapMode);
  let result = null;

  result = !crawlData ? crawlData : "No recruitment data";
  res.json({ result });
});

// OK
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
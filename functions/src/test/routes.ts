import { Router } from "express";
import { CRAWL_MODE } from "../constants/crawlMode";
import { crawlService } from "../services/crawlService";
import { getRedisInstance } from "../providers/redis/client/getInstance";
import { ProxyStore, RecruitStore } from "../providers/firebase/store";
import { scanKeys } from "../providers/redis/client/scanKeys";
import { proxyScraper } from "../crawlers/proxy";
import { recruitServices } from "../services/recruitService";

const testRouter = Router();

testRouter.get("/recruit", async (req, res, next) => {
  try {
    const { city } = req.query;

    const recruitList = await recruitServices(CRAWL_MODE.DUMMY, city);

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
  const redisInstance = getRedisInstance();
  const recruitServiceName = redisInstance.getKeyManager().recruit.getServiceName() || "";
  const pattern = recruitServiceName + "*";

  const keys: string[] = await scanKeys(pattern);
  DebugLogger.request(`🚀 ~ testRouter.get ~ found keys: ${keys.length}`);
  const redisValues: Record<string, any> = {};

  for (const key of keys) {
    try {
      redisValues[key] = await redisInstance.getDataByKeyFromRedis(key);
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
  const firestore = new RecruitStore();
  const result = await firestore.getRecruitList();

  res.json({ result });
});

testRouter.get("/firestore-proxy", async (req, res) => {
  const firestore = new ProxyStore();
  const result = await firestore.getProxyList();

  res.json({ result });
});

testRouter.get("/proxy-scraper", async (req, res) => {
  const result = await proxyScraper();
  const firestore = new ProxyStore();
  firestore.saveProxyList(result);
  res.json({ result });
});

testRouter.get("/playwright-scraper", async (req, res) => {
  const mode = req.query.mode || "dummy";
  DebugLogger.server(`route /playwright-scraper with mode: ${mode}`);

  try {
    const scrapMode = mode === "crawl" ? CRAWL_MODE.CRAWL : CRAWL_MODE.DUMMY;
    const crawlData = await crawlService(scrapMode);
    if (!crawlData) res.json({ result: crawlData });
    else res.json({ result: "No recruitment data" });
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error in playwright-scraper:", error);
    }
    res.status(500).send("An error occurred during scraping.");
  }
});

testRouter.get("/discord", async (req, res) => {
  
});

export { testRouter };

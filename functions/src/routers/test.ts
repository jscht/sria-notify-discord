import { Router } from "express";
import { CRAWL_MODE } from "../constants/crawlMode";
import { crawlService } from "../services/crawlService";
import { getRedisInstance } from "../providers/redis/client/getInstance";
import { RecruitFireStore } from "../providers/firebase/firestore";
import { scanKeys } from "../providers/redis/client/scanKeys";
import { discordService } from "../services/discordService";
import dummyData from "../crawlers/sriagent/dummyData/recruit_list.json";
import { ResponseRecruitData } from "../types/responseRecruitData";

const testRouter = Router();

testRouter.get("/redis-stores", async (req, res) => {
  const redisInstance = getRedisInstance();
  const recruitServiceName = redisInstance.getKeyManager().recruit.getServiceName() || "";
  const pattern = recruitServiceName + "*";

  // RedisStore 내부에서 서비스를 호출할 때 부르는 키는 어떻게 할 것인지 생각해보기
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

testRouter.get("/firebase-stores", async (req, res) => {
  const firestore = new RecruitFireStore();
  const result = await firestore.getRecruitList();

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
  await discordService(dummyData as ResponseRecruitData[]);
});

export { testRouter };

import { Router } from "express";
import { CRAWL_MODE } from "../constants/crawlMode";
import { crawlService } from "../services/crawlService";
import redisInstance from "../utils/redis";
import { RedisKeys } from "../types/redisKeys";
import { RecruitFireStore } from "../providers/firebase/firestore";

const testRouter = Router();

testRouter.get("/redis-stores", async (req, res) => {
  const keys: RedisKeys[] = ["recruit:list", "recruit:id_store", "recruit:hash_store"];
  const redisValues: Record<RedisKeys, any> = {} as Record<RedisKeys, any>;

  for (const key of keys) {
    try {
      redisValues[key] = (await redisInstance).getFromRedis(key);
    } catch (error) {
      console.error(`Error fetching key "${key}" from Redis:`, error);
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
  DebugLogger.server("route /playwright-scraper");
  try {
    const crawl_data = await crawlService(CRAWL_MODE.DUMMY);
    if (crawl_data.length !== 0) res.json({ result: crawl_data });
    else res.json({ result: "No recruitment data" });
  } catch (error) {
    console.error("Error in playwright-scraper:", error);
    res.status(500).send("An error occurred during scraping.");
  }
});

export { testRouter };
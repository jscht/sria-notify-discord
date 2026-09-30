import "@/common/utils/systemLogger";
import { Router } from "express";
import { RecruitService } from "../services";
import { scanKeys } from "../providers/redis/client/scanKeys";
import { SERVICE_NAME } from "../providers/redis/constants/serviceName";
import { RedisManager } from "../providers/redis/manager/redisManager";
import { RecruitStore } from "../providers/firebase/store";

const testRouter = Router();

// OK — 3-tier 조회(도시 필터)
testRouter.get("/recruit", async (req, res, next) => {
  try {
    const { city } = req.query;

    const recruitService = new RecruitService();
    const { data: recruitList } = await recruitService.getRecruitList(city as string | undefined);

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

export { testRouter };

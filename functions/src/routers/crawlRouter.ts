import { Router } from "express";
import { logger } from "firebase-functions";
import { isValidCityName } from "../utils/isValidCityName";
import { City } from "../types/city";
import { crawlService } from "../services/crawlService";

const crawlRouter = Router();

crawlRouter.get("/recruit", async (req, res, next) => {
  const { city } = req.query;
  const queryCity: City | undefined 
    = (!city || typeof city !== 'string' || isValidCityName(city as string))
    ? undefined 
    : city as City;

  console.time("crawlService");
  const result = await crawlService(queryCity);
  console.timeEnd("crawlService");

  if (result?.message) {
    next({ status: 500, message: result.message }); // 에러 객체 반환
    return;
  }
  logger.info(`"/recruit" 정상 처리`);
  res.status(200).json({ message: "정상 처리" });
});

export { crawlRouter };

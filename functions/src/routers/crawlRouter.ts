import { Router } from "express";
import { logger } from "firebase-functions";
import { isValidCityName } from "../utils/isValidCityName";
import { City } from "../types/city";
import { crawlService } from "../services/crawlService";

const crawlRouter = Router();

crawlRouter.get("/", (req, res) => {
  let result = null;

  const { city } = req.query;
  if (!city || typeof city !== 'string' || isValidCityName(city as string)) {
    // 전체 조회
    result = crawlService();
  }

  // 지역별 조회
  result = crawlService(city as City);

//   const { error, status, message } = result;
//   if (error) {
//     next(error);
//     return;
//   }
//   res.status(status).json({ message });
  res.status(200).json({ message: "message" });
});

export { crawlRouter };

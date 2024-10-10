import { Router } from "express";
import { logger } from "firebase-functions";
import { recruitServices } from "../services/recruitService";
import { discordService } from "../services/discordService";
import { ResponseRecruitData } from "../types/responseRecruitData";

const recruitRouter = Router();

recruitRouter.get("/recruit", async (req, res, next) => {
  try {
    const { city } = req.query;

    console.time("recruitServices");
    const recruitList = await recruitServices(city);
    console.timeEnd("recruitServices");

    if (recruitList) {
      await discordService(recruitList as ResponseRecruitData[]);
    }

    if (!city) {
      logger.info("/recruit 정상 처리");
    } else {
      logger.info(`/recruit/?city=${city} 정상 처리`);
    }
    res.status(200).json({ message: "정상 처리" });
  } catch (error) {
    if (error instanceof Error) {
      next(error);
    }
  }
});

export { recruitRouter };

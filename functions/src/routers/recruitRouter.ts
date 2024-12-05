import { Router } from "express";
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

    const logMessage = !city
      ? "/recruit 정상 처리"
      : `/recruit/?city=${city} 정상 처리`;
    DebugLogger.server(logMessage);
    
    res.status(200).json({ message: "정상 처리", result: recruitList });
  } catch (error) {
    next(error);
  }
});

export { recruitRouter };

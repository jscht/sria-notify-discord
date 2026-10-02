import { RecruitKeyManager } from "./recruitKeyManager";
import { RequestLimitKeyManager } from "./requestLimitKeyManager";

export const redisKeyManager = {
  recruit: new RecruitKeyManager(),
  requestLimit: new RequestLimitKeyManager(),
};

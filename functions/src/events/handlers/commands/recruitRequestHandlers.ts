import { DiscordBotCommand } from "@/common/constants";
import { onRecruitRequest } from "../../listeners/commands/onRecruitRequest";

export const recruitCommandHandlers = {
  [DiscordBotCommand.RECRUIT_REQUEST]: onRecruitRequest,
} as const;
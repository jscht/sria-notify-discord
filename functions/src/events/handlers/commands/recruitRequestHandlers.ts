import { DiscordBotCommand } from "@/providers/discord/constants";
import { onRecruitRequest } from "../../listeners/commands/onRecruitRequest";

export const recruitCommandHandlers = {
  [DiscordBotCommand.RECRUIT_REQUEST]: onRecruitRequest,
} as const;
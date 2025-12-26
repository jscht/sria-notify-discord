import { DiscordBotCommand } from "../../../constants/discordBotCommand";
import { onRecruitRequest } from "../../listeners/commands/onRecruitRequest";

export const recruitCommandHandlers = {
  [DiscordBotCommand.RECRUIT_REQUEST]: onRecruitRequest,
} as const;
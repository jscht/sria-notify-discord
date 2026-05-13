import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";

export type SubscribeClearPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
};

export async function subscribeClear(_payload: SubscribeClearPayload): Promise<void> {
  // Phase 1.5: SubscriptionService 연동으로 구현 예정
  throw new Error("subscribeClear: not yet implemented (Phase 1.5)");
}

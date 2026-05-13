import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";

export type SubscribeAddPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region?: string;
};

export async function subscribeAdd(_payload: SubscribeAddPayload): Promise<void> {
  // Phase 1.5: SubscriptionService 연동으로 구현 예정
  throw new Error("subscribeAdd: not yet implemented (Phase 1.5)");
}

import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";

export type SubscribeRemovePayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region: string;
};

export async function subscribeRemove(_payload: SubscribeRemovePayload): Promise<void> {
  // Phase 1.5: SubscriptionService 연동으로 구현 예정
  throw new Error("subscribeRemove: not yet implemented (Phase 1.5)");
}

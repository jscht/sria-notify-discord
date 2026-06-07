import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "@/events/listeners/buttons/renderSubscribeManage";

export type SubscribeClearPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
};

/**
 * 지역 초기화 — 선택 지역을 즉시 비우고(`updateRegions([])`) 관리 화면을 재렌더한다.
 * Firestore 쓰기가 선행하므로 `deferUpdate` 후 공유 헬퍼로 임베드를 갱신한다.
 */
export async function subscribeClear(payload: SubscribeClearPayload): Promise<void> {
  const { interaction } = payload;
  if (!interaction.isButton()) {
    return;
  }

  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  try {
    const updated = await alarmSubscriptionService.updateRegions(interaction.user.id, []);
    await renderSubscribeManage(interaction, updated);
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

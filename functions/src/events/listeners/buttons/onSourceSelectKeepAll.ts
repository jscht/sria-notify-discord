import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { finishFirstSourceStep } from "./firstSourceStep";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * SOURCE_SELECT:KEEP_ALL 버튼 핸들러.
 *
 * 첫 구독에서 만든 문서가 이미 사이트 "전체"이므로 저장하지 않고 마무리한다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onSourceSelectKeepAll(interaction: ButtonInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  try {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await finishFirstSourceStep(interaction, sub, "✅ 모든 사이트의 공고를 받아요.");
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

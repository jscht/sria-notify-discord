import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";
import { showAlertModeSelectButtons } from "@/providers/discord/builder/buttons/showAlertModeSelectButtons";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";

/**
 * SUBSCRIBE_OPTION:ENABLE 버튼 핸들러.
 *
 * - 기존 설정 보유(꺼짐 상태): 모드 재선택 없이 `resubscribe`로 즉시 재활성화 →
 *   진입 화면(켜짐)으로 복귀. 사용자가 곧바로 [🔕 알림 끄기]로 다시 토글 가능.
 * - 최초 사용자(문서 없음): 기존 모드 선택 흐름으로 진입.
 *
 * Firestore 접근이 있으므로 `deferUpdate` 후 `editReply`로 갱신한다.
 */
export async function onShowSubscribeEnable(interaction: ButtonInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  const userId = interaction.user.id;

  try {
    const sub = await alarmSubscriptionService.getSubscription(userId);

    // 기존 설정 보유 → 모드 재선택 없이 즉시 재활성화
    if (sub) {
      const updated = await alarmSubscriptionService.resubscribe(userId);
      const { content, components } = buildSubscribeEntryView(updated);
      await interaction.editReply({ content, components, embeds: [] });
      return;
    }

    // 최초 사용자 → 모드 선택 흐름
    await interaction.editReply({
      content: "✅ 알림 모드 설정을 시작할게요.",
      components: [showAlertModeSelectButtons()],
    });
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

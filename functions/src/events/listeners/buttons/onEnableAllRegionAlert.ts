import type { ButtonInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { AlertMode } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";

/**
 * ALERT_MODE:ALL 버튼 핸들러.
 *
 * 전체 지역 알림(ALL) 모드를 확정한다.
 * - 신규 사용자(모드 null): `subscribe`로 신규 활성화(이벤트 발행은 서비스 내부)
 * - 기존 사용자가 다른 모드: `updateMode`로 ALL 전환
 * 이미 ALL이면 추가 쓰기 없이 현재 구독을 다시 조회한다.
 * 확정 후 완료 토스트와 함께 진입 화면으로 복귀해 막다른 화면을 없앤다.
 */
export async function onEnableAllRegionAlert(interaction: ButtonInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  const userId = interaction.user.id;

  try {
    const current = await alarmSubscriptionService.getUserAlertMode(userId);
    let sub: AlarmSubscription | null;
    if (current === null) {
      sub = await alarmSubscriptionService.subscribe(userId, {
        enabled: true,
        alertMode: AlertMode.ALL,
        regions: [],
      });
    } else if (current !== AlertMode.ALL) {
      sub = await alarmSubscriptionService.updateMode(userId, AlertMode.ALL);
    } else {
      sub = await alarmSubscriptionService.getSubscription(userId);
    }

    const { content, components } = buildSubscribeEntryView(sub);
    await interaction.editReply({
      content: `✅ 모든 지역 알림이 설정되었어요.\n\n${content}`,
      components,
      embeds: [],
    });
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

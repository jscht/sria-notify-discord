import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { ButtonInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { AlertMode } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "@/events/listeners/buttons/renderSubscribeManage";

/**
 * ALERT_MODE:SELECTED 버튼 핸들러.
 *
 * 선택 지역 알림(SELECTED) 모드를 확정하고 지역 편집 UI로 진입한다.
 * - 신규 사용자(모드 null): `subscribe`로 신규 활성화
 * - 기존 사용자가 다른 모드: `updateMode`로 SELECTED 전환
 * 확정 후 현재 지역 목록과 지역 편집 버튼을 노출한다.
 */
export async function onEnableSelectedRegionAlert(interaction: ButtonInteraction): Promise<void> {
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
        alertMode: AlertMode.SELECTED,
        regions: [],
      });
    } else if (current !== AlertMode.SELECTED) {
      sub = await alarmSubscriptionService.updateMode(userId, AlertMode.SELECTED);
    } else {
      sub = await alarmSubscriptionService.getSubscription(userId);
    }

    // 방어: 구독 정보가 없으면 #1과 동일하게 뒤로가기만 노출하고 종료한다.
    if (!sub) {
      await interaction.editReply({
        content: "아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.",
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(subscribeOptionActionId.BACK)
              .setLabel("⬅️ 뒤로")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }

    await renderSubscribeManage(interaction, sub);
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

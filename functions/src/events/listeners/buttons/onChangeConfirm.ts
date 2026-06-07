import type { ButtonInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import { renderSubscribeManage } from "./renderSubscribeManage";

/**
 * REGION_MODE_CHANGE:CONFIRM 버튼 핸들러.
 *
 * 모드 변경 확인 단계. 현재 모드의 반대 모드로 전환한다(ALL ⇄ SELECTED).
 * 변경 후 갱신된 구독으로 관리 화면을 재렌더한다.
 * 구독 문서가 없으면 `updateMode` 내부 `ensureExists`가 기본 문서를 만든 뒤 변경한다.
 */
export async function onChangeConfirm(interaction: ButtonInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });
  const userId = interaction.user.id;

  try {
    const current = await alarmSubscriptionService.getUserAlertMode(userId);
    const nextMode = current === AlertMode.SELECTED ? AlertMode.ALL : AlertMode.SELECTED;
    const updated = await alarmSubscriptionService.updateMode(userId, nextMode);

    await renderSubscribeManage(interaction, updated);
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}

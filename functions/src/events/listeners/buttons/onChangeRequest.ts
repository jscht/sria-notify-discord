import type { ButtonInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { showConfirmChangeAlertModeButtons } from "@/providers/discord/builder/buttons/showConfirmChangeAlertModeButtons";
import { disableMessageComponents } from "@/providers/discord/builder/disableMessageComponents";

/**
 * REGION_MODE_CHANGE:OPEN 버튼 핸들러.
 *
 * 현재 알림 모드를 조회해 반대 모드로의 전환 여부를 확인하는 화면을 띄운다.
 * 모드가 없으면 기본 ALL로 간주한다.
 */
export async function onChangeRequest(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    components: disableMessageComponents(interaction.message),
  });
  const userId = interaction.user.id;

  const current = (await alarmSubscriptionService.getUserAlertMode(userId)) ?? AlertMode.ALL;
  const currentLabel = current === AlertMode.ALL ? "전체 지역" : "선택 지역";
  const nextMode = current === AlertMode.SELECTED ? AlertMode.ALL : AlertMode.SELECTED;
  const nextLabel = nextMode === AlertMode.ALL ? "전체 지역" : "선택 지역";

  await interaction.editReply({
    content: `현재 **${currentLabel}** 모드예요. **${nextLabel}** 모드로 바꿀까요?`,
    components: [showConfirmChangeAlertModeButtons()],
    embeds: [],
  });
}

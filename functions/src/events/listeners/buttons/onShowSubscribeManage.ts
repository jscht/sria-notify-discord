import { ButtonInteraction } from "discord.js";
import { alertRegionEditButtons } from "../../../providers/discord/builder/buttons/alertRegionEditButtons";
import { AlertModeSelectAction } from "../../../constants/alertModeSelectAction";
import { onShowSubscribeEnable } from "./onShowSubscribeEnable";
import { SubscribeStatus } from "../../../constants/userAlertSetting";

export async function onShowSubscribeManage(interaction: ButtonInteraction) {
  const userId = interaction.user.id;
  const currentMode: SubscribeStatus = await getUserAlertMode(userId);

  // 구독 모드가 설정되지 않은 경우 → 안내 후 구독 활성화 플로우로 이동
  if (currentMode === null) {
    await interaction.update({
      content: "🔔 알림을 먼저 활성화해주세요!",
      components: []
    });

    return onShowSubscribeEnable(interaction);
  }

  const isSelectedRegionMode = currentMode === AlertModeSelectAction.SELECTED;
  const buttons = alertRegionEditButtons(isSelectedRegionMode);
  await interaction.update({
    content: "⚙️ 지역 설정을 시작할게요.\n(전체 지역 모드일 땐 제거 버튼이 비활성화됩니다.)",
    components: [buttons]
  });
}
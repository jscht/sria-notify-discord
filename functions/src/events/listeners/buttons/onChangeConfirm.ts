import { ButtonInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import { alertRegionEditButtons } from "../../../providers/discord/builder/buttons/alertRegionEditButtons";

export async function onChangeConfirm(interaction: ButtonInteraction) {
  const userId = interaction.user.id;
  const currentMode: SubscribeStatus = await getUserAlertMode(userId);



  const isSelectedRegionMode = currentMode === AlertMode.SELECTED;
  const buttons = alertRegionEditButtons();
  await interaction.update({
    content: "✅ 선택 지역 알림 모드 설정을 시작할게요.",
    components: [buttons]
  });
}
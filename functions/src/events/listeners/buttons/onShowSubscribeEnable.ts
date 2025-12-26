import { ButtonInteraction } from "discord.js";
import { showAlertModeSelectButtons } from "../../../providers/discord/builder/buttons/showAlertModeSelectButtons";

export async function onShowSubscribeEnable(interaction: ButtonInteraction) {
  const buttons = showAlertModeSelectButtons();
  await interaction.update({
    content: "✅ 알림 모드 설정을 시작할게요.",
    components: [buttons]
  });
}
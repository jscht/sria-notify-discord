import { ButtonInteraction, CommandInteraction } from "discord.js";
import { SubscribeCommand } from "../../../constants/alarmSubscribeCommand";

export type SubscribeClearPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
};

export async function subscribeClear({ interaction, mode }: SubscribeClearPayload) {
  const userId = interaction.user.id;
  const alertInfo = await getAlertInfo(userId);

  if (!alertInfo) {
    await interaction.editReply("⚠️ 현재 설정된 알림이 없어서 초기화할 알림이 없어요.")
  }

  const { mode: currentMode } = alertInfo;

  if (currentMode != mode) {
    await interaction.editReply(`⚠️ 현재 설정된 알림 유형이 달라 작업을 수행할 수 없어요.`);
    return;
  }

  await clearUserAlertSettings(userId);
  await interaction.editReply("🧹 모든 지역 알림 설정이 초기화되었어요.");
}
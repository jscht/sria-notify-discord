import { ButtonInteraction, CommandInteraction } from "discord.js";
import { SubscribeCommand } from "../../../constants/alarmSubscribeCommand";
import { cityNameConverter } from "../../../utils/cityName";
import { CityKo } from "../../../types/city";
import { AlertModeSelectAction } from "../../../constants/alertModeSelectAction";

export type SubscribeRemovePayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region: string;
};

export async function subscribeRemove({ interaction, mode, region }: SubscribeRemovePayload) {
  let koreanRegion = cityNameConverter.toKorean(region) as CityKo;
  const userId = interaction.user.id;
  const { regions: currentRegions } = await getAlertInfo(userId);

  if (!region) {
    await interaction.editReply("❗ 알림을 제거할 지역을 입력해주세요.");
    return;
  }

  // 이 작업은 선택 지역 구독 중 일 때만 사용됨.
  if (mode === AlertModeSelectAction.ALL) {
    await interaction.editReply(`⚠️ 모든 지역 알림 설정 중이라 이 작업을 수행할 수 없어요.`);
    return;
  }

  if (currentRegions.length === 0) {
    await interaction.editReply(`⚠️ 등록된 지역이 없어 제거를 할 수 없어요.`);
    return;
  }

  if (!currentRegions.includes(koreanRegion)) {
    await interaction.editReply(`⚠️ \`${koreanRegion}\` 지역은 등록되어 있지 않아요.`);
    return;
  }

  const updatedRegions = currentRegions.filter((rg: string) => rg !== koreanRegion);

  const alertSetting = buildAlertSetting(userId, updatedRegions, "SELECTED_REGIONS", mode)

  await updateUserAlertSettings(alertSetting);
  await interaction.editReply(
    `🗑️ \`${koreanRegion}\` 지역 알림이 제거되었어요.\n\n
    현재 알림이 등록된 지역 : ${updatedRegions.join(", ")}`
  );
}
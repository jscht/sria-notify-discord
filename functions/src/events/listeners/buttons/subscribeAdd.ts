import { ButtonInteraction, CommandInteraction } from "discord.js";
import { SubscribeCommand } from "../../../constants/alarmSubscribeCommand";
import { cityNameConverter } from "../../../utils/cityName";
import { chooseEunNeun } from "../../../utils/koreanJosaUtils";
import { CityKo } from "../../../types/city";
import { MAX_REGION_COUNT } from "../../../providers/discord/builder/commands/slash/alarmSubscribe";

export type SubscribeAddPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region?: string;
};

export async function subscribeAdd({ interaction, mode, region }: SubscribeAddPayload) {
  const userId = interaction.user.id;
  // Firebase에서 유저 설정 불러오기
  // const currentRegions = ["서울"];  // ← 예시
  const { mode: currentMode, regions: currentRegions } = await getAlertInfo(userId);

  if (currentRegions && region) {
    let koreanRegion = cityNameConverter.toKorean(region) as CityKo;

    if (currentRegions.includes(koreanRegion)) {
      await interaction.editReply(
        `⚠️ \`${koreanRegion}\`${chooseEunNeun(koreanRegion)} 이미 등록된 지역이에요.`
      );
      return;
    }

    if (currentRegions.length >= MAX_REGION_COUNT) {
      await interaction.editReply(`⚠️ 최대 ${MAX_REGION_COUNT}개의 지역만 등록할 수 있어요.`);
      return;
    }

    const updatedRegions = [...currentRegions, koreanRegion];

    const alertSetting = buildAlertSetting(userId, updatedRegions, currentMode, mode);

    await updateUserAlertSettings(alertSetting);
    await interaction.editReply(
      `✅ \`${koreanRegion}\` 지역의 알림이 등록되었어요.\n
      새로운 공고가 등록되면 알려드릴게요.\n\n
      현재 알림이 등록된 지역 : ${updatedRegions.join(", ")}`
    );

    return;
  }

  const alertSetting = buildAlertSetting(userId, currentRegions, currentMode, mode);

  await updateUserAlertSettings(alertSetting);
  await interaction.editReply(
    `✅ \`전체 지역 알림이 설정되었어요.\n
    새로운 공고가 등록되면 알려드릴게요.`
  );
  return;
}
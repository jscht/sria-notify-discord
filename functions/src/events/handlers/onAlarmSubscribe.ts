import { CommandInteraction } from "discord.js";
import { AlarmSubscribeCommandAction, MAX_REGION_COUNT } from "../../providers/discord/commands/alarmSubscribe";
import { cityNameConverter, isValidCityName } from "../../utils/cityName";
import { chooseEunNeun } from "../../utils/koreanJosaUtils";
import { CityKo } from "../../types/city";

export async function onAlarmSubscribeCommand(interaction: CommandInteraction) {
  const userId = interaction.user.id;
  const operation = interaction.options.get("작업")?.value as AlarmSubscribeCommandAction;
  const region = interaction.options.get("지역")?.value;

  if (region && typeof region === "string" && !isValidCityName(region)) {
    await interaction.reply(`⚠️ \`${region}\`${chooseEunNeun(region)} 존재하지 않는 지역이에요.`);
    return;
  }

  let koreanRegion = cityNameConverter.toKorean(region as string) as CityKo | string;

  // Firebase에서 유저 설정 불러오기
  // const settings = await getUserAlertSettings(userId);
  const settings = ["서울"]; // ← 예시, 실제로는 Firebase에서 가져옴

  // const response = await axios.get(`${process.env.API_BASE_URL}/notices?region=${encodeURIComponent(region)}`);

  const { ADD, CLEAR, REMOVE } = AlarmSubscribeCommandAction;

  try {
    await interaction.deferReply({ ephemeral: true });

    if (operation === ADD) {
      if (!region) {
        await interaction.editReply("❗ 추가할 지역을 입력해주세요.");
        return;
      }

      if (settings.includes(koreanRegion)) {
        await interaction.editReply(`⚠️ \`${koreanRegion}\`${chooseEunNeun(koreanRegion)} 이미 등록된 지역이에요.`);
        return;
      }

      if (settings.length >= MAX_REGION_COUNT) {
        await interaction.editReply(`⚠️ 최대 ${MAX_REGION_COUNT}개의 지역만 등록할 수 있어요.`);
        return;
      }

      const updated = [...settings, koreanRegion];
      // await updateUserAlertSettings(userId, updated);
      await interaction.editReply(`✅ \`${koreanRegion}\` 지역의 알림이 등록되었어요. \n새로운 공고가 등록되면 알려드릴게요.`);
    }

    else if (operation === REMOVE) {
      if (!region) {
        await interaction.editReply("❗ 알림을 제거할 지역을 입력해주세요.");
        return;
      }

      if (!settings.includes(koreanRegion)) {
        await interaction.editReply(`⚠️ \`${koreanRegion}\` 지역은 등록되어 있지 않아요.`);
        return;
      }

      const updated = settings.filter(r => r !== koreanRegion);
      // await updateUserAlertSettings(userId, updated);
      await interaction.editReply(`🗑️ \`${koreanRegion}\` 지역 알림이 제거되었어요.`);
    }

    else if (operation === CLEAR) {
      // await updateUserAlertSettings(userId, []);
      await interaction.editReply("🧹 모든 지역 알림 설정이 초기화되었어요.");
    }

    else {
      await interaction.editReply("❓ 알 수 없는 작업입니다.");
    }
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error fetching notification:", error);
    }
    await interaction.editReply("⚠️ 공고 알림을 설정하는 데 실패했어요.");
  }
}
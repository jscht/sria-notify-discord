import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { DiscordBotCommand } from ".";
import { isValidCityName } from "../../../utils/isValidCityName";
import { chooseEunNeun } from "../../../utils/koreanJosaUtils";
import { cityNameConverter } from "../../../utils/cityNameConverter";
import { CityEn, CityKo } from "../../../types/city";

export enum NotificationCommandAction {
  ADD = "add",
  REMOVE = "remove",
  CLEAR = "clear",
}

const { ADD, REMOVE, CLEAR } = NotificationCommandAction;

export const notificationCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.Notification)
  .setDescription("공고 알림을 설정합니다.")
  .addStringOption(option =>
    option.setName("작업")
      .setDescription("추가: add, 제거: remove, 전부 제거: clear")
      .setRequired(true)
      .addChoices(
        { name: "➕ 추가", value: ADD },
        { name: "➖ 제거", value: REMOVE },
        { name: "🧹 전부 제거", value: CLEAR },
      )
  )
  .addStringOption(option =>
    option.setName("지역")
      .setDescription("설정하거나 제거할 지역 (clear 작업 시 생략)")
      .setRequired(false)
  );

const MAX_REGION_COUNT = 2;

export const handleNotificationCommand = async (interaction: CommandInteraction) => {
  const userId = interaction.user.id;
  const operation = interaction.options.get("작업")?.value as NotificationCommandAction;
  const region = interaction.options.get("지역")?.value as string | undefined;

  const koreanRegion = cityNameConverter.toKorean(region as CityEn | CityKo) as string

  if (!isValidCityName(region)) {
    await interaction.reply(`⚠️ \`${region}\`${chooseEunNeun(koreanRegion)} 존재하지 않는 지역이에요.`);
    return;
  }

  // Firebase에서 유저 설정 불러오기
  // const settings = await getUserAlertSettings(userId);
  const settings = ["서울"]; // ← 예시, 실제로는 Firebase에서 가져옴

  // const response = await axios.get(`${process.env.API_BASE_URL}/notices?region=${encodeURIComponent(region)}`);

  try {
    await interaction.deferReply({ ephemeral: true });

    if (operation === ADD) {
      if (!region) {
        await interaction.editReply("❗ 추가할 지역을 입력해주세요.");
        return;
      }

      if (settings.includes(region)) {
        await interaction.editReply(`⚠️ \`${region}\`${chooseEunNeun(koreanRegion)} 이미 등록된 지역이에요.`);
        return;
      }

      if (settings.length >= MAX_REGION_COUNT) {
        await interaction.editReply(`⚠️ 최대 ${MAX_REGION_COUNT}개의 지역만 등록할 수 있어요.`);
        return;
      }

      const updated = [...settings, region];
      // await updateUserAlertSettings(userId, updated);
      await interaction.editReply(`✅ \`${region}\` 지역의 알림이 등록되었어요. \n새로운 공고가 등록되면 알려드릴게요.`);
    }

    else if (operation === REMOVE) {
      if (!region) {
        await interaction.editReply("❗ 알림을 제거할 지역을 입력해주세요.");
        return;
      }

      if (!settings.includes(region)) {
        await interaction.editReply(`⚠️ \`${region}\` 지역은 등록되어 있지 않아요.`);
        return;
      }

      const updated = settings.filter(r => r !== region);
      // await updateUserAlertSettings(userId, updated);
      await interaction.editReply(`🗑️ \`${region}\` 지역 알림이 제거되었어요.`);
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
};
import "@/common/utils/logger";
import { ButtonInteraction, MessageFlags } from "discord.js";
import { SubscribeCommand } from "../../../constants/alarmSubscribeCommand";
import { AlertModeSelectAction } from "../../../constants/alertModeSelectAction";
import { SubscribeStatus } from "../../../constants/userAlertSetting";
import { showConfirmChangeAlertModeButtons } from "../../../providers/discord/builder/buttons/showConfirmChangeAlertModeButtons";

export async function onEnableAllRegionAlert(interaction: ButtonInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mode: SubscribeCommand = AlertModeSelectAction.ALL;
    const userId = interaction.user.id;
    const currentMode: SubscribeStatus = await getUserAlertMode(userId);

    // Case 1 ) 최초 설정 (currentMode === null)
    if (currentMode === null) {
      await setUserAlertMode(userId, mode);
      await interaction.editReply("🔔 모든 지역 알림을 활성화했어요!");
      return;
    }

    // Case 2 ) 이미 동일 모드 설정 O
    if (mode === currentMode) {
      await interaction.editReply("⚠️ 이미 모든 지역 알림이 설정되어 있어요.");
      return;
    }

    // Case 3 ) 기존 모드와 다른 경우 → 모드 변경 확인 버튼 제공
    // 공고 유형 변경 여부 확인(버튼) -> 수정 유형 선택(버튼) -> 수정 작업(모달)
    const confirmButtons = showConfirmChangeAlertModeButtons();
    await interaction.editReply({
      content: "⚠️ 현재 선택 지역 알림이 설정되어 있어요.\n모든 지역 알림 모드로 전환할까요?",
      components: [confirmButtons]
    });

    // non-buttonEvent -> modalEvent
    // const action = interaction.options.get("작업")?.value as AlarmSubscribeActions<typeof mode>;

    // non-buttonEvent -> modalEvent
    // switch(action) {
    //   case "REGION_EDIT:ADD":
    //     onAlertRegionEdit({ action, payload: { interaction, mode } });
    //     break;
    //   case "REGION_EDIT:CLEAR":
    //     onAlertRegionEdit({ action, payload: { interaction, mode } });
    //     break;
    //   default:
    //     await interaction.editReply("❓ 알 수 없는 작업입니다.");
    // }

    // interaction.followUp({
    //   content: "✅ 모든 지역 알림이 설정되었어요.",
    //   flags: MessageFlags.Ephemeral
    // });

  } catch (error) {
    if (error instanceof Error) {
      globalLogger.error("Error enabling all region alert:", error);
    }
    await interaction.editReply("⚠️ 알림 설정 중 문제가 발생했어요.");
  }
}
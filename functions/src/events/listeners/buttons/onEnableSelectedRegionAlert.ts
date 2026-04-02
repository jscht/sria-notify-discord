import "@/common/utils/systemLogger";
import { ButtonInteraction, MessageFlags } from "discord.js";
import { isValidCityName } from "../../../utils/cityName";
import { chooseEunNeun } from "../../../utils/koreanJosaUtils";
import { AlarmSubscribeActions, SubscribeCommand } from "../../../constants/alarmSubscribeCommand";
import { AlertModeSelectAction } from "../../../constants/alertModeSelectAction";
import { SubscribeStatus } from "../../../constants/userAlertSetting";

export async function onEnableSelectedRegionAlert(interaction: ButtonInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // ButtonInteraction -> ModalInteraction -> value

    /* --------------------------
      1) 지역명 유효성 검증 (모달 입력 이후 흐름)
    --------------------------- */
    const cityName = interaction.options.get("지역")?.value;

    if (!!cityName && isValidCityName(cityName)) {
      await interaction.editReply(`⚠️ \`${cityName}\`${chooseEunNeun(cityName as string)} 존재하지 않는 지역이에요.`);
      return;
    }

    const region = cityName as string | undefined;

    const mode: SubscribeCommand = AlertModeSelectAction.SELECTED;
    const userId = interaction.user.id;
    const currentMode: SubscribeStatus = await getUserAlertMode(userId);

    /* --------------------------
      2) 기존 모드가 없는 경우
      → 선택 지역 알림 모드로 바로 설정
    --------------------------- */

    if (currentMode === null) {
      // 바로 지역 설정 버튼 제공
      await interaction.editReply({
        content: "🔔 선택 지역 알림 설정을 시작할게요!",
      });
      // 이후 지역 선택 버튼 or 모달 호출 부분 연결
      return;
    }

    if (mode === currentMode) {
      interaction.reply({ 
        content: "⚠️ 이미 선택 지역 알림이 설정되어 있어요.", 
        flags: MessageFlags.Ephemeral 
      });
      return;
    }

    // 공고 유형 변경 여부 확인(버튼, 모달할까?) -> 수정 유형 선택(버튼) -> 수정 작업(모달)

    // non-buttonEvent -> modalEvent
    const action = interaction.options.get("작업")?.value as AlarmSubscribeActions<typeof mode>;

    // non-buttonEvent -> modalEvent
    switch(action) {
      case "REGION_EDIT:ADD":
        onAlertRegionEdit({ 
          action, payload: { interaction, mode, region } 
        });
        break;
      case "REGION_EDIT:REMOVE":
        onAlertRegionEdit({ 
          action, payload: { interaction, mode, region } 
        });
        break;
      case "REGION_EDIT:CLEAR":
        onAlertRegionEdit({ action, payload: { interaction, mode } });
        break;
      default:
        await interaction.editReply("❓ 알 수 없는 작업입니다.");
    }

    interaction.followUp({
      content: "✅ 선택 지역 알림이 설정되었어요.",
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    if (error instanceof Error) {
      globalLogger.error("Error selectedRegionMode fetching notification:", error);
    }
    await interaction.followUp({
      content: "⚠️ 공고 알림을 설정하는 데 실패했어요."
    });
  }
}
import { CommandInteraction, MessageFlags } from "discord.js";
import { SubscribeCommand } from "../../../constants/alarmSubscribeCommand";
import { showSubscribeOptionButtons } from "../../../providers/discord/builder/buttons/showSubscribeOptionButtons";

/**
 * 알림 모드 변경 플로우
 *
 * 사용자의 기존 알림 모드(currentMode)와 사용자가 선택한 모드(mode)를 비교하여 다음 흐름으로 분기한다.
 *
 * 1) 기존 설정이 없는 경우 (currentMode === null)  
 *    => onShowSubscribeManage  
 *    • 사용자가 선택한 모드가 최초 모드로 바로 설정된다.
 *      - "ALL" → 전체 지역 알림을 즉시 활성화
 *      - "SELECTED_REGIONS" → 선택 지역 알림 설정으로 즉시 진입
 *
 * 2) 기존 설정 모드와 요청 모드가 동일한 경우 (mode === currentMode)  
 *    => onEnableAllRegionAlert, onEnableSelectedRegionAlert  
 *    • 이미 선택한 모드와 동일한 설정이므로 변경 없이 안내 메시지를 제공한다.
 *
 * 3) 기존 설정 모드와 요청 모드가 다른 경우  
 *    => onEnableAllRegionAlert, onEnableSelectedRegionAlert  
 *    • 사용자가 알림 모드를 변경하려는 상황  
 *    • 변경 확인을 위한 버튼 UI(모드 전환 선택지)를 출력하여,
 *      사용자가 명시적으로 승인할 때만 설정을 변경한다.
 */
export async function onAlarmSubscribe(interaction: CommandInteraction) {
  const buttons = showSubscribeOptionButtons();
  const contentText = "🔔 알림을 시작하거나 설정을 변경할 수 있어요.";

  interaction.reply({
    content: contentText,
    components: [buttons],
  });

  // 사용자가 요청한 새로운 모드
  const mode = interaction.options.get("모드")?.value as SubscribeCommand;
  const userId = interaction.user.id;
  // 기존에 저장된 모드(없으면 null)
  const currentMode: SubscribeCommand | null = await getUserAlertMode(userId);

  // 1) 기존 설정이 없는 경우

  // 2) 기존 모드와 사용자가 요청한 모드가 같은 경우

  // 3) 기존 모드와 요청 모드가 다른 경우
  // → 모드를 바꿀 것인지 확인하기 위한 버튼 UI reply
  const buttons = regionModeChangeButtons();
  const contentText = 
    currentMode === "ALL"
      ? "⚠️ 현재 모든 지역 알림이 설정되어 있어요. 선택 지역 알림 모드로 변경할까요?"
      : "⚠️ 현재 선택 지역 알림 모드가 설정되어 있어요. 모든 지역 알림 모드로 변경할까요?"

  interaction.reply({
    content: contentText,
    components: [buttons],
    flags: MessageFlags.Ephemeral,
  });
}
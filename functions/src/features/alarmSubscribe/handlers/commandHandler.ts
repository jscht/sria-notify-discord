import { CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "../types";
import { showSubscribeOptionButtons } from "../interactions/buttons";

/**
 * Slash Command Handler: /alarm-subscribe
 * 
 * 알림 모드 변경 플로우
 * - 기존 설정이 없는 경우: 새로운 모드로 바로 설정
 * - 기존 모드와 같은 경우: 안내 메시지
 * - 기존 모드와 다른 경우: 변경 확인 요청
 */
export async function onAlarmSubscribe(interaction: CommandInteraction): Promise<void> {
  const buttons = showSubscribeOptionButtons();
  const contentText = "🔔 알림을 시작하거나 설정을 변경할 수 있어요.";

  await interaction.reply({
    content: contentText,
    components: [buttons],
  });

  // TODO: 사용자 알림 모드 조회 및 처리 로직
  // - getUserAlertMode(userId) 호출
  // - 기존 모드와 비교하여 분기 처리
  // - 필요시 모드 변경 확인 버튼 표시
}

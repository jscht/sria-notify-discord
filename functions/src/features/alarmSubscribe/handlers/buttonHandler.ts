import { ButtonInteraction } from "discord.js";

/**
 * Button Handler for Alarm Subscribe Feature
 * - 알림 켜기
 * - 설정 관리
 */

export async function onSubscribeOptionButton(interaction: ButtonInteraction) {
  // TODO: 버튼 ID에 따라 분기 처리
  // - ENABLE: 알림 활성화
  // - MANAGE: 설정 관리 페이지 이동

  await interaction.deferReply({ ephemeral: true });
}

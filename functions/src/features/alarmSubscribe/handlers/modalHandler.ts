import { ModalSubmitInteraction } from "discord.js";

/**
 * Modal Handler for Alarm Subscribe Feature
 * - 지역 선택 모달 처리
 */

export async function onRegionSelectModal(interaction: ModalSubmitInteraction) {
  // TODO: 모달 입력값 처리
  // - region 값 추출
  // - subscriptionService.updateRegions() 호출
  // - 사용자에게 결과 응답

  await interaction.deferReply({ ephemeral: true });
}

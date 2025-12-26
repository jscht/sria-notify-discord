import { ActionRowBuilder, ButtonInteraction, CommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

/**
 * 지역 선택 모달
 * 사용자가 알림 받을 지역을 입력하는 모달
 */
export async function regionSelectModal(interaction: CommandInteraction | ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("alarm-subscribe-modal")
    .setTitle("지역 알림 설정");

  const regionInput = new TextInputBuilder()
    .setCustomId("region")
    .setLabel("지역 이름 (clear 작업 시 생략 가능)")
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(regionInput),
  );

  await interaction.showModal(modal);
}

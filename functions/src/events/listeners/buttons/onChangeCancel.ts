import { ButtonInteraction } from "discord.js";

export async function onChangeCancel(interaction: ButtonInteraction) {
  await interaction.update({
    content: "❌ 작업이 취소되었습니다.",
    components: [],
  });
}
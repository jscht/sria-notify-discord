import { CommandInteraction } from "discord.js";
import type { RecruitData } from "../types";

/**
 * Slash Command Handler: /recruit-request
 * 사용자가 요청한 지역의 공고 목록을 조회하여 응답
 */
export async function onRecruitRequest(interaction: CommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: false });

  const city = interaction.options.get("지역")?.value || null;
  const userId = interaction.user.id;

  // TODO: recruitService를 통해 공고 조회
  // - getCityRecruitList(city) 또는 getAllRecruitList()
  // - 조회한 공고 목록을 embeds로 포맷팅
  // - 사용자에게 응답

  const response = {
    content: `🔍 지역별 공고 조회 결과${city ? ` (${city})` : ""}`,
    ephemeral: false,
  };

  await interaction.editReply(response);
}

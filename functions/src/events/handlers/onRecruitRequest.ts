import { CommandInteraction } from "discord.js";
import { RecruitService } from "../../services/recruitService";
import { CRAWL_MODE } from "../../constants/crawlMode";
import { isValidCityName } from "../../utils/cityName";

export async function onRecruitRequest(interaction: CommandInteraction) {
  try {
    const region = interaction.options.get("지역")?.value;
    if (region && typeof region === "string" && !isValidCityName(region)) {
      await interaction.editReply(`⚠️ 존재하지 않는 지역이에요.`);
    }

    await interaction.deferReply();
    
    const recruitService = new RecruitService();
    const list = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, region as string | undefined);
    if (!list || list.length === 0) {
      await interaction.editReply(`❌ \`${region}\` 지역에 대한 공고가 없습니다.`);
      return;
    }

    // const message = discordResponseBuilder.buildRecruitListMessage(list, city);
    await interaction.editReply("message");
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("onRecruitRequest Error:", error);
    }
    await interaction.editReply("⚠️ 공고 요청 처리 중 오류가 발생했습니다.");
  }
}
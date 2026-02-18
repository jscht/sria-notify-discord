import "@/common/utils/systemLogger";
import { CommandInteraction } from "discord.js";
import { RecruitService } from "../../../services";
import { CRAWL_MODE } from "../../../constants/crawlMode";
import { isValidCityName } from "../../../utils/cityName";
import { recruitMessageEmbed } from "../../../providers/discord/builder/embeds/recruitMessageEmbed";
import { chooseEunNeun } from "../../../utils/koreanJosaUtils";

export async function onRecruitRequest(interaction: CommandInteraction) {
  try {
    await interaction.deferReply();

    const cityName = interaction.options.get("지역")?.value;
    const result = validateRegion(cityName);

    let region: string | undefined;

    if (result === false) {
      await interaction.editReply(
        `⚠️ \`${cityName}\`${chooseEunNeun(cityName as string)} 존재하지 않는 지역이에요.`
      );
      return;
    }

    region = result === true ? (cityName as string) : undefined;

    const recruitService = new RecruitService();
    const list = await recruitService.getRecruitList(CRAWL_MODE.DUMMY, region);
    if (!list || list.length === 0) {
      await interaction.editReply(`❌ \`${region}\` 지역에 대한 공고가 없어요.`);
      return;
    }

    const message = recruitMessageEmbed(list, region);
    await interaction.editReply({
      embeds: [message]
    });
  } catch (error) {
    if (error instanceof Error) {
      globalLogger.error("onRecruitRequest Error:", error);
    }
    await interaction.editReply("⚠️ 공고 요청 처리 중 오류가 발생했어요.");
  }
}

function validateRegion(cityName: any): boolean | undefined {
  if (!cityName) {
    return undefined;
  }

  return isValidCityName(cityName);
}
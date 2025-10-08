import { APIEmbed, EmbedBuilder } from "discord.js";
import { ResponseRecruitData } from "../../../types/responseRecruitData";

function extractJobId(path: string) {
  const match = path.match(/\/jobs\/(\d+)/);
  return match ? match[1] : "";
}

export function recruitMessageBuilder(list: ResponseRecruitData[], region?: string): APIEmbed {
  const title = `📢 ${region ?? "전체"} 지역 공고`;
  const topCount = 3;
  const description = list.length 
    ? `총 ${list.length}건의 공고가 검색되었어요. 상위 ${topCount}개를 먼저 보여드릴게요.`
    : `📭 ${region ?? "해당"} 지역 공고가 없어요.`;
  const footer = `🔗 전체 공고는 [웹에서 확인해 보세요.](${process.env.SRI_URL})`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(list.length ? 0x00b0f4 : 0xff0000)
    .setTimestamp();

  list.slice(0, topCount).forEach((item, index) => {
    embed
      .addFields({
        name: `\n`,
        value: `
          ${index + 1}. [${item.title}](${process.env.SRI_URL}${extractJobId(item.href)})
          \n📅 ${item.dayTxt} | ⏱ ${item.dDay} | 🏷️ 상태: ${item.recruitmentStatus}
        `,
      })
  });

  embed.addFields({
    name: "\n",
    value: `${footer}`
  })

  return embed.toJSON();
}
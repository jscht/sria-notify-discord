import { APIEmbed, EmbedBuilder } from "discord.js";
import { ResponseRecruitData } from "../../../types/responseRecruitData";

function extractJobId(path: string) {
  const match = path.match(/\/jobs\/(\d+)/);
  return match ? match[1] : "";
}

export function recruitMessageBuilder(list: ResponseRecruitData[], region?: string): APIEmbed {
  const title = `📢 ${region ?? "전체"} 지역 공고 목록`;
  const description = list.length
    ? `총 ${list.length}건의 공고가 검색되었습니다. 상위 5개 항목을 표시합니다.`
    : `📭 ${region ?? "해당"} 지역 공고가 없습니다.`;
  const footer = list.length > 5
    ? `🔗 그 외 ${list.length - 5}건의 공고는 웹에서 확인해 주세요.`
    : "";

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(list.length ? 0x00b0f4 : 0xff0000)
    .setFooter({ text: footer })
    .setTimestamp();

  list.slice(0, 5).forEach((item, index) => {
    embed.addFields({
      name: `🔹 ${index + 1}. ${item.title}`,
      value: `📅 ${item.dayTxt} | ⏱ ${item.dDay} | 🏷️ 상태: ${item.recruitmentStatus}\n🔗 [자세히 보기](${process.env.SRI_URL}${extractJobId(item.href)})`,
    });
  });

  return embed.toJSON();
}
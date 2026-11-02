import { APIEmbed, EmbedBuilder } from "discord.js";
import type { RecruitDisplay } from "@/common/types";
import { formatRecruitGroups } from "./recruitList";

/** 사이트마다 임베드에 표시할 상위 공고 개수. */
const TOP_COUNT = 3;

/**
 * 공고 조회 커맨드용 임베드를 생성한다.
 *
 * 임베드 필드 값은 1024자 한도라 넘칠 수 있어 목록을 description(4096자) 하나에 넣는다.
 *
 * @param list 노출 사이트 공고. 시작 날짜 최신순으로 정렬되어 있다
 * @param region 조회한 지역. 없으면 전체 지역
 * @returns 공고 조회용 임베드 JSON
 */
export function recruitMessageEmbed(list: RecruitDisplay[], region?: string): APIEmbed {
  const title = `📢 ${region ?? "전체"} 지역 공고`;
  const { blocks } = formatRecruitGroups(list, { detail: "detailed", topCount: TOP_COUNT });
  const description = list.length ?
    [
      `총 ${list.length}건의 공고가 검색되었어요. 사이트마다 상위 ${TOP_COUNT}건을 먼저 보여드릴게요.`,
      ...blocks,
    ].join("\n\n") :
    `📭 ${region ?? "해당"} 지역 공고가 없어요.`;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(list.length ? 0x00b0f4 : 0xff0000)
    .setTimestamp()
    .toJSON();
}

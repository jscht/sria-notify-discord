import { APIEmbed, EmbedBuilder } from "discord.js";
import type { Job } from "@/common/types/job.d";
import { ENV } from "@/common/utils";
import { formatJobTitleLink } from "./jobLink";

/** 알림 임베드에 필드로 직접 표시할 상위 공고 개수. */
const TOP_COUNT = 3;
/** "외 N건 더 있습니다" 요약 줄을 추가하는 임계 공고 수. */
const OVERFLOW_THRESHOLD = 6;

/**
 * 새 공고 알림 DM용 임베드를 생성한다.
 *
 * "🔔 새로운 채용 공고" 헤더 + 상위 3개 공고를 필드로 표시한다.
 * 공고가 6건 이상이면 마지막에 "외 N건 더 있습니다" 한 줄을 덧붙인다(I-4).
 * Discord 25필드/6000자 한계는 상위 3개만 표시하므로 자연 충족한다.
 *
 * @param jobs 새로 등록된 공고 목록 (이벤트 페이로드의 `Job[]`)
 * @returns 알림용 임베드 JSON
 */
export function notificationMessageEmbed(jobs: Job[]): APIEmbed {
  const baseUrl = ENV.SRIA_URL;

  const embed = new EmbedBuilder()
    .setTitle("🔔 새로운 채용 공고")
    .setDescription(`총 ${jobs.length}건의 새로운 공고가 등록되었어요.`)
    .setColor(0x00b0f4)
    .setTimestamp();

  jobs.slice(0, TOP_COUNT).forEach((job, index) => {
    const r = job.value; // Job.value: RecruitData
    const titleLine = formatJobTitleLink(r.title, r.href, baseUrl);
    embed.addFields({
      name: "\n",
      value: `${index + 1}. ${titleLine}\n📅 ${r.dayTxt} | ⏱ ${r.dDay} | 🏷️ 상태: ${r.recruitmentStatus}`,
    });
  });

  if (jobs.length >= OVERFLOW_THRESHOLD) {
    embed.addFields({
      name: "\n",
      value: `외 ${jobs.length - TOP_COUNT}건 더 있습니다.`,
    });
  }

  return embed.toJSON();
}

import type { RecruitDisplay, SriaRecruit } from "@/common/types";

/**
 * dayTxt에서 시간 부분을 제거해 날짜 범위만 남긴다.
 *
 * "2024.09.20 00:00 ~ 2024.09.26 23:59" → "2024.09.20 ~ 2024.09.26".
 * "~"로 split한 결과가 2조각이 아니면 원본을 그대로 반환한다(방어).
 * sria `dayTxt` 형식에만 맞는 규칙이라 embed가 아닌 sria 변환에 둔다.
 *
 * @param dayTxt 원본 기간 문자열
 * @returns 시간이 제거된 "시작 ~ 종료" 문자열
 */
function trimDate(dayTxt: string): string {
  const parts = dayTxt.split("~").map((t) => t.trim().split(" ")[0]);
  return parts.length === 2 ? `${parts[0]} ~ ${parts[1]}` : dayTxt;
}

/**
 * sria 공고를 공통 표시 형식으로 바꾼다 (Pure Function)
 *
 * 값이 있는 칸만 `extraFields`에 넣는다. `index.ts`와 서로 import하는 순환을 피하려고
 * 표시 이름은 인자로 받는다.
 *
 * @param r sria 공고
 * @param label 사이트 표시 이름 (`SourceConfig.displayName`)
 * @returns 공통 표시 형식
 */
export function sriaToDisplay(r: SriaRecruit, label: string): RecruitDisplay {
  return {
    source: "sria",
    sourceLabel: label,
    title: r.title,
    postedBy: r.postedBy,
    url: r.url || undefined,
    period: trimDate(r.dayTxt),
    status: r.recruitmentStatus,
    extraFields: [
      ...(r.postedAt ? [{ name: "작성", value: r.postedAt }] : []),
      ...(r.dDay ? [{ name: "마감", value: r.dDay }] : []),
    ],
  };
}

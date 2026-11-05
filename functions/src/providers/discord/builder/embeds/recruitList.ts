/**
 * 공고 목록 그리기 (DM 알림·공고 조회 공용).
 *
 * `notificationMessageEmbed`와 `recruitMessageEmbed`는 이 파일로만 목록을 만든다.
 * 소스별 공고 타입은 읽지 않고 `RecruitDisplay`만 읽는다.
 * 들어온 순서를 바꾸지 않으므로 정렬은 호출하는 쪽이 끝내 두어야 한다.
 */

import type { RecruitDisplay, RecruitSource } from "@/common/types";
import { getSourceConfig, getUserFacingSources } from "@/providers/recruit";
import { formatJobTitleLink } from "./jobLink";

/** "simple"(간단히) = DM 알림, "detailed"(자세히) = 공고 조회 커맨드 */
export type DisplayDetail = "simple" | "detailed";

/** 제목 맨 앞의 `[…]`. 지역은 따로 저장된 값이 아니라 이 부분이다. */
const LEADING_TAG = /^\[[^\]]*\]/;

/**
 * 제목의 지역 뒤에 `[상태]`를 넣는다.
 *
 * 공고 데이터의 제목은 바꾸지 않으므로 공고 비교값에 영향이 없다.
 *
 * @param title 공고 제목
 * @param status 모집 상태. 없으면 제목을 그대로 돌려준다
 * @returns `[서울][접수중] 카페 스태프`. `[…]`로 시작하지 않으면 `[접수중] 카페 스태프`
 */
function titleWithStatus(title: string, status?: string): string {
  if (!status) return title;

  const leadingTag = LEADING_TAG.exec(title)?.[0];
  if (!leadingTag) return `[${status}] ${title}`;
  return `${leadingTag}[${status}]${title.slice(leadingTag.length)}`;
}

/**
 * 자세히 모드 둘째 줄의 칸을 만든다. 값이 빈 칸은 뺀다.
 *
 * @param display 공고 표시 정보
 * @returns 기간, 게시자, 추가 칸 순서의 글자 목록
 */
function detailCells(display: RecruitDisplay): string[] {
  const extraCells = (display.extraFields ?? [])
    .filter(({ value }) => value)
    .map(({ name, value }) => `${name} ${value}`);

  return [
    display.period ? `📅 ${display.period}` : "",
    display.postedBy,
    ...extraCells,
  ].filter(Boolean);
}

/**
 * 공고 한 건을 그린다.
 *
 * @param d 공고 표시 정보
 * @param index 목록 번호. 1부터 시작한다
 * @param detail 간단히는 기간을, 자세히는 기간·게시자·추가 칸을 둘째 줄에 그린다
 * @returns 공고 한 건의 글자
 */
export function formatRecruitLine(
  d: RecruitDisplay,
  index: number,
  detail: DisplayDetail,
): string {
  const titleLine = `${index}. ${formatJobTitleLink(titleWithStatus(d.title, d.status), d.url)}`;

  if (detail === "simple") {
    return d.period ? `${titleLine}\n📅 ${d.period}` : titleLine;
  }

  const cells = detailCells(d);
  return cells.length > 0 ? `${titleLine}\n${cells.join(" | ")}` : titleLine;
}

/**
 * 공고를 사이트별로 나눈다.
 *
 * 순서는 `getUserFacingSources()`를 따르고, 이 목록에 없는 사이트는 그 뒤에 들어온 순서대로 붙인다.
 * 사이트 안 항목은 들어온 순서를 지킨다.
 *
 * @param displays 공고 표시 정보 목록
 * @returns 공고가 1건 이상 있는 사이트만
 */
function groupBySource(displays: RecruitDisplay[]): [RecruitSource, RecruitDisplay[]][] {
  const groups = new Map(
    getUserFacingSources().map((source): [RecruitSource, RecruitDisplay[]] => [source, []])
  );

  for (const display of displays) {
    const group = groups.get(display.source);
    if (group) {
      group.push(display);
    } else {
      groups.set(display.source, [display]);
    }
  }

  return [...groups].filter(([, items]) => items.length > 0);
}

/**
 * 사이트 묶음의 꼬리줄을 만든다.
 *
 * @param overflowCount 상위 건수 밖의 공고 수
 * @param detail 자세히 모드는 밖 공고가 없어도 링크를 보여 준다
 * @param url 전체 공고 주소. 없으면 링크 부분을 뺀다
 * @returns 꼬리줄. 보여 줄 내용이 없으면 빈 문자열
 */
function formatFooter(overflowCount: number, detail: DisplayDetail, url?: string): string {
  const link = url ? `[전체 공고 보기](${url})` : "";

  if (overflowCount > 0) {
    const overflow = `▸ 이 외 ${overflowCount}건 더 있어요`;
    return link ? `${overflow} · ${link}` : overflow;
  }
  return detail === "detailed" && link ? `🔗 ${link}` : "";
}

/**
 * 공고를 사이트별 묶음으로 그린다.
 *
 * 블록 하나는 머리줄 + 상위 `topCount`건 + 꼬리줄이다.
 * 상위 건수는 사이트마다 따로 센다.
 *
 * @param displays 정렬이 끝난 공고 표시 정보 목록
 * @param options 표시 모드와 사이트별 상위 건수
 * @returns 블록 목록과, "이 외 n건"이 붙은 블록이 있는지 여부
 */
export function formatRecruitGroups(
  displays: RecruitDisplay[],
  options: { detail: DisplayDetail; topCount: number },
): { blocks: string[]; hasOverflow: boolean } {
  const { detail, topCount } = options;
  const itemSeparator = detail === "simple" ? "\n" : "\n\n";
  let hasOverflow = false;

  const blocks = groupBySource(displays).map(([source, items]) => {
    const overflowCount = Math.max(items.length - topCount, 0);
    if (overflowCount > 0) hasOverflow = true;

    const header = `**🌐 ${items[0].sourceLabel}** · ${items.length}건`;
    const lines = items
      .slice(0, topCount)
      .map((item, index) => formatRecruitLine(item, index + 1, detail));
    const footer = formatFooter(overflowCount, detail, getSourceConfig(source).url);
    const body = (footer ? [...lines, footer] : lines).join(itemSeparator);

    return `${header}\n${body}`;
  });

  return { blocks, hasOverflow };
}

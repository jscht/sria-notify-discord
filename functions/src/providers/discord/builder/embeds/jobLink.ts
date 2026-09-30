/**
 * 공고 링크·표시 필드 공용 헬퍼. (Phase 1.10 재정의)
 *
 * recruitMessageEmbed / notificationMessageEmbed가 공유한다.
 * `Recruit`는 사이트별 union(temp는 동적 스키마)이라, base가 아닌 표시 필드는
 * `recruitField`로 방어적으로(있으면 표시, 없으면 빈 문자열) 읽는다.
 */

import type { Recruit } from "@/common/types";

/**
 * 공고 제목을 마크다운 링크로 포맷한다. url이 없으면 제목만 반환.
 */
export function formatJobTitleLink(title: string, url?: string): string {
  return url ? `[${title}](${url})` : title;
}

/**
 * Recruit(union·동적 temp 포함)에서 표시 필드를 안전하게 문자열로 읽는다.
 * 값이 없으면 빈 문자열.
 */
export function recruitField(r: Recruit, key: string): string {
  const v = (r as Record<string, unknown>)[key];
  return v == null ? "" : String(v);
}

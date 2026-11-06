/**
 * 공고 링크 공용 헬퍼.
 *
 * 공고 목록을 그리는 `recruitList.ts`가 쓴다.
 */

/**
 * 공고 제목을 마크다운 링크로 포맷한다. url이 없으면 제목만 반환.
 */
export function formatJobTitleLink(title: string, url?: string): string {
  return url ? `[${title}](${url})` : title;
}

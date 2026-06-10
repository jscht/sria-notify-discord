/**
 * 공고 링크 공용 헬퍼 (DRY 추출)
 *
 * recruitMessageEmbed / notificationMessageEmbed가 공유하는 순수 함수.
 * 기존 recruitMessageEmbed의 인라인 표현을 동작 변경 없이 캡슐화한다.
 */

/**
 * href("/jobs/12345")에서 jobId("12345")를 추출한다.
 *
 * @param path 공고 상세 경로 (예: "/jobs/12345")
 * @returns 추출된 jobId 문자열. 매치 실패 시 빈 문자열("").
 * @example extractJobId("/jobs/12345") // "12345"
 */
export function extractJobId(path: string): string {
  const match = path.match(/\/jobs\/(\d+)/);
  return match ? match[1] : "";
}

/**
 * 공고 제목을 마크다운 링크로 포맷한다.
 *
 * baseUrl이 없으면 링크 없이 제목만 반환한다
 * (기존 recruitMessageEmbed의 baseUrl 분기 동작과 동일).
 *
 * @param title 공고 제목
 * @param href 공고 상세 경로 (예: "/jobs/12345")
 * @param baseUrl 공고 페이지 base URL (없으면 링크 미생성)
 * @returns `[title](baseUrl{jobId})` 또는 title
 */
export function formatJobTitleLink(
  title: string,
  href: string,
  baseUrl?: string
): string {
  return baseUrl ? `[${title}](${baseUrl}${extractJobId(href)})` : title;
}

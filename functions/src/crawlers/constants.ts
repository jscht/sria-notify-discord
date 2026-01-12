/**
 * 크롤러 전략 상수
 */

/**
 * 크롤러 전략 타입
 */
export const CrawlerStrategy = {
  /** 일반 채용 크롤러 */
  RECRUIT: "recruit",
  /** 프록시 크롤러 */
  PROXY: "proxy",
} as const;

export type CrawlerStrategyType = (typeof CrawlerStrategy)[keyof typeof CrawlerStrategy];

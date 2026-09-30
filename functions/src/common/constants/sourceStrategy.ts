/**
 * 에러 컨텍스트용 공고 소스 전략 상수.
 *
 * (Phase 1.10에서 crawlers/ 제거 시 common으로 이전. SystemError 컨텍스트 라벨 전용 —
 *  실제 크롤러는 더 이상 없고 mock 소스 프로바이더로 대체됨.)
 */
export const SourceStrategy = {
  /** 공고 소스 관련 */
  RECRUIT: "recruit",
} as const;

export type SourceStrategyType = (typeof SourceStrategy)[keyof typeof SourceStrategy];

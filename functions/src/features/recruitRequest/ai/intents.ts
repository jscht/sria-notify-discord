/**
 * Recruit Request Feature - Intent Definitions
 * 이 기능에서 인식 가능한 사용자 의도 정의
 */

export const RECRUIT_INTENTS = {
  REQUEST: "request",               // "공고 봐줄래", "채용정보 알려줘"
  SEARCH_BY_LOCATION: "search_by_location", // "서울 공고 봐줄래"
  SEARCH_LATEST: "search_latest",   // "최신 공고 봐줄래"
  FILTER: "filter",                 // "개발자 공고만 봐줄래"
} as const;

export type RecruitIntent = typeof RECRUIT_INTENTS[keyof typeof RECRUIT_INTENTS];

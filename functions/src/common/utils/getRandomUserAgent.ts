/**
 * Random User Agent Generator Utility
 * 크롤링 시 사용할 랜덤 User Agent 생성
 */

import userAgentStrings from "../../mocks/crawlers/user-agents.json";

export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * userAgentStrings.length);
  return userAgentStrings[index];
}

import userAgentStrings from "../data/user-agents.json";

/**
 * 랜덤 User Agent 생성
 */
export function getRandomUserAgent(): string {
  const index = Math.floor(Math.random() * userAgentStrings.length);
  return userAgentStrings[index];
}

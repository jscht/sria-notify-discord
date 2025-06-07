import userAgentStrings from "../mocks/crawlers/user-agents.json";

export function getRandomUserAgent() {
  const index = Math.floor(Math.random() * userAgentStrings.length);
  return userAgentStrings[index];
}
import { Message } from "discord.js";
import { interpretRecruitMessage } from "./interpreter";
import { RECRUIT_INTENTS } from "./intents";
import { recruitRequestService } from "../services/recruitService";

/**
 * Recruit Request Feature - AI Handler
 * 자연어로 들어온 메시지를 처리하여 공고 조회 실행
 */

export async function handleRecruitAI(message: Message, userText: string): Promise<string> {
  const userId = message.author.id;

  // 1. 자연어 해석
  const result = await interpretRecruitMessage(userText, userId);

  if (!result.intent || result.confidence < 0.5) {
    return "죄송하지만 공고 검색과 관련된 요청으로 이해할 수 없습니다. 다시 말씀해주세요.";
  }

  // 2. Intent에 따라 처리
  try {
    switch (result.intent) {
      case RECRUIT_INTENTS.REQUEST:
        return await handleRequest(result.entities.locations);

      case RECRUIT_INTENTS.SEARCH_BY_LOCATION:
        return await handleSearchByLocation(result.entities.locations);

      case RECRUIT_INTENTS.SEARCH_LATEST:
        return await handleSearchLatest();

      case RECRUIT_INTENTS.FILTER:
        return await handleFilter(result.entities);

      default:
        return "알 수 없는 요청입니다.";
    }
  } catch (error) {
    console.error("Error in handleRecruitAI:", error);
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

async function handleRequest(locations?: string[]): Promise<string> {
  // TODO: recruitRequestService를 통해 공고 조회
  const recruits = await recruitRequestService.getRecruitList();
  return "📋 공고 목록을 조회했습니다.";
}

async function handleSearchByLocation(locations?: string[]): Promise<string> {
  // TODO: 특정 지역의 공고 조회
  const city = locations?.[0];
  const recruits = await recruitRequestService.getRecruitList(city);
  return `🔍 ${city} 지역의 공고를 조회했습니다.`;
}

async function handleSearchLatest(): Promise<string> {
  // TODO: 최신 공고 조회
  return "🆕 최신 공고를 조회했습니다.";
}

async function handleFilter(entities: any): Promise<string> {
  // TODO: 필터링된 공고 조회 (직군, 회사 등)
  return "🔎 필터링된 공고를 조회했습니다.";
}

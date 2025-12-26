import { Message } from "discord.js";

/**
 * Global AI - Dispatcher
 * 사용자 메시지를 어느 feature로 라우팅할지 결정
 */

export type FeatureType = "alarmSubscribe" | "recruitRequest" | "unknown";

/**
 * 사용자 메시지를 분석하여 적절한 feature로 라우팅
 * 순환 참조를 피하기 위해 동적 import 사용
 */
export async function dispatchAIMessage(
  message: Message,
  userText: string
): Promise<string> {
  // 1. 어느 feature인지 분류
  const feature = await classifyFeature(userText);

  // 2. Feature에 따라 처리 (동적 import로 순환 참조 방지)
  switch (feature) {
    case "alarmSubscribe": {
      const { handleAlarmAI } = await import("@/features/alarmSubscribe/ai/handler");
      return await handleAlarmAI(message, userText);
    }

    case "recruitRequest": {
      const { handleRecruitAI } = await import("@/features/recruitRequest/ai/handler");
      return await handleRecruitAI(message, userText);
    }

    default:
      return "죄송하지만 도움을 드릴 수 없습니다. 명령어를 사용해주세요.";
  }
}

/**
 * 메시지를 분석하여 어느 feature인지 분류
 */
async function classifyFeature(userText: string): Promise<FeatureType> {
  // TODO: LLM을 사용하여 feature 분류
  // 또는 키워드 기반 분류
  
  const lowerText = userText.toLowerCase();

  // 간단한 키워드 기반 분류 (향후 LLM으로 개선)
  if (lowerText.includes("알람") || lowerText.includes("알림") || lowerText.includes("구독")) {
    return "alarmSubscribe";
  }

  if (lowerText.includes("채용") || lowerText.includes("공고") || lowerText.includes("요청")) {
    return "recruitRequest";
  }

  return "unknown";
}

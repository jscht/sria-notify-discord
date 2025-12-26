import { Message } from "discord.js";
import { interpretAlarmMessage } from "./interpreter";
import { ALARM_INTENTS } from "./intents";
import { alarmSubscriptionService } from "../services/subscriptionService";

/**
 * Alarm Subscribe Feature - AI Handler
 * 자연어로 들어온 메시지를 처리하여 실제 비즈니스 로직 실행
 */

export async function handleAlarmAI(message: Message, userText: string): Promise<string> {
  const userId = message.author.id;

  // 1. 자연어 해석
  const result = await interpretAlarmMessage(userText, userId);

  if (!result.intent || result.confidence < 0.5) {
    return "죄송하지만 알림 설정과 관련된 요청으로 이해할 수 없습니다. 다시 말씀해주세요.";
  }

  // 2. Intent에 따라 처리
  try {
    switch (result.intent) {
      case ALARM_INTENTS.SUBSCRIBE:
        return await handleSubscribe(userId, result.entities.regions);

      case ALARM_INTENTS.UNSUBSCRIBE:
        return await handleUnsubscribe(userId);

      case ALARM_INTENTS.UPDATE:
        return await handleUpdate(userId, result.entities);

      case ALARM_INTENTS.CHECK_STATUS:
        return await handleCheckStatus(userId);

      default:
        return "알 수 없는 요청입니다.";
    }
  } catch (error) {
    console.error("Error in handleAlarmAI:", error);
    return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
}

async function handleSubscribe(userId: string, regions?: string[]): Promise<string> {
  // TODO: subscriptionService를 통해 구독 처리
  return "✅ 알람이 켜졌습니다!";
}

async function handleUnsubscribe(userId: string): Promise<string> {
  // TODO: subscriptionService를 통해 구독 취소
  return "❌ 알람이 꺼졌습니다.";
}

async function handleUpdate(userId: string, entities: any): Promise<string> {
  // TODO: subscriptionService를 통해 설정 업데이트
  return "✏️ 알람 설정이 업데이트되었습니다.";
}

async function handleCheckStatus(userId: string): Promise<string> {
  // TODO: subscriptionService를 통해 현재 설정 조회
  return "📋 현재 알람 설정을 확인했습니다.";
}

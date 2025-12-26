import type { AlarmIntent } from "./intents";

/**
 * Alarm Subscribe Feature - Interpreter
 * 자연어 메시지를 alarm subscribe 기능의 의도와 엔티티로 변환
 */

export interface AlarmInterpretResult {
  intent: AlarmIntent | null;
  entities: {
    regions?: string[];
    mode?: "ALL" | "SELECTED_REGIONS";
  };
  confidence: number;
}

export async function interpretAlarmMessage(
  userMessage: string,
  userId: string
): Promise<AlarmInterpretResult> {
  // TODO: AI 처리
  // 1. 글로벌 ai/nlp를 통해 entity 추출 (지역명 등)
  // 2. 글로벌 ai/llm을 통해 intent 분류
  // 3. 결과를 AlarmInterpretResult로 반환

  return {
    intent: null,
    entities: {},
    confidence: 0,
  };
}

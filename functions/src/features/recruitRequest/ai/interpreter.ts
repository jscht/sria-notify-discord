import type { RecruitIntent } from "./intents";

/**
 * Recruit Request Feature - Interpreter
 * 자연어 메시지를 recruit request 기능의 의도와 엔티티로 변환
 */

export interface RecruitInterpretResult {
  intent: RecruitIntent | null;
  entities: {
    locations?: string[];
    jobCategories?: string[];
    companies?: string[];
    keywords?: string[];
  };
  confidence: number;
}

export async function interpretRecruitMessage(
  userMessage: string,
  userId: string
): Promise<RecruitInterpretResult> {
  // TODO: AI 처리
  // 1. 글로벌 ai/nlp를 통해 entity 추출
  //    - 지역명 (서울, 부산 등)
  //    - 직군명 (개발자, 디자이너 등)
  //    - 회사명
  //    - 키워드
  // 2. 글로벌 ai/llm을 통해 intent 분류
  // 3. 결과를 RecruitInterpretResult로 반환

  return {
    intent: null,
    entities: {},
    confidence: 0,
  };
}

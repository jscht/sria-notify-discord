/**
 * Global AI - LLM Module
 * LLM API 호출 통합
 * 
 * 지원: OpenAI, Claude, Gemini 등
 */

export interface LLMResponse {
  content: string;
  tokens: {
    input: number;
    output: number;
  };
  model: string;
}

/**
 * LLM에 프롬프트 질의
 * @param prompt - 사용자 프롬프트
 * @param systemPrompt - 시스템 프롬프트 (선택)
 * @returns LLM 응답
 */
export async function askLLM(
  prompt: string,
  systemPrompt?: string
): Promise<LLMResponse> {
  // TODO: LLM API 호출 구현
  // - OpenAI API 또는 다른 LLM 클라이언트 사용
  // - Rate limiting 적용
  // - 비용 추적
  
  return {
    content: "",
    tokens: { input: 0, output: 0 },
    model: "gpt-4",
  };
}

/**
 * LLM으로 JSON 형식 응답 요청
 */
export async function askLLMForJSON<T = Record<string, any>>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  // TODO: JSON 스키마 지정하여 LLM 호출
  // - JSON 파싱 및 검증
  
  return {} as T;
}

/**
 * LLM 설정
 */
export interface LLMConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function initializeLLM(config: LLMConfig): void {
  // TODO: LLM 클라이언트 초기화
  // - 환경 변수에서 API 키 로드
  // - 모델 설정 저장
}

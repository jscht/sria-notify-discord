/**
 * Global AI Module
 * 모든 feature에서 공통으로 사용하는 AI 기반 서비스
 */

// NLP
export { extractEntity, normalizeText } from "./nlp/entityExtractor";

// LLM
export { askLLM, askLLMForJSON, initializeLLM } from "./llm/client";
export type { LLMResponse, LLMConfig } from "./llm/client";

// Dispatcher
export { dispatchAIMessage } from "./dispatcher";
export type { FeatureType } from "./dispatcher";

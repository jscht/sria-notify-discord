/**
 * Global AI - NLP Module
 * 일반적인 자연어 처리 기능
 */

/**
 * 텍스트에서 숫자, 날짜, 지역 등 일반적 엔티티 추출
 */
export async function extractEntity(text: string) {
  // TODO: 실제 구현
  // - 숫자 추출 (정규표현식)
  // - 날짜 추출
  // - 지역명 추출
  
  return {
    numbers: extractNumbers(text),
    dates: extractDates(text),
    locations: extractLocations(text),
  };
}

function extractNumbers(text: string): number[] {
  // TODO: 숫자 추출
  return [];
}

function extractDates(text: string): Date[] {
  // TODO: 날짜 추출
  return [];
}

function extractLocations(text: string): string[] {
  // TODO: 지역명 추출
  return [];
}

/**
 * 텍스트 정규화 (토크나이제이션, 소문자화 등)
 */
export function normalizeText(text: string): string {
  // TODO: 텍스트 정규화
  return text.toLowerCase().trim();
}

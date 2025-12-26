/**
 * Korean Josa (조사) Utility
 * 한국어 조사 자동 선택 (은/는, 을/를 등)
 */

function hasFinalConsonant(koreanChar: string): boolean {
  const code = koreanChar.charCodeAt(0) - 0xac00;
  const jong = code % 28;
  return jong !== 0;
}

/**
 * 은/는 선택
 * @param word 단어
 * @returns '은' 또는 '는'
 */
export function chooseEunNeun(word: string): string {
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? '은' : '는';
}

/**
 * 을/를 선택
 * @param word 단어
 * @returns '을' 또는 '를'
 */
export function chooseEulReul(word: string): string {
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? '을' : '를';
}

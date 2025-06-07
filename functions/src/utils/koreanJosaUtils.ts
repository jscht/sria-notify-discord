function hasFinalConsonant(koreanChar: string) {
  const code = koreanChar.charCodeAt(0) - 0xac00;
  const jong = code % 28;
  return jong !== 0;
}

// 은/는 선택 함수
export function chooseEunNeun(word: string) {
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? '은' : '는';
}

// 을/를 선택 함수
export function chooseEulReul(word: string) {
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? '을' : '를';
}
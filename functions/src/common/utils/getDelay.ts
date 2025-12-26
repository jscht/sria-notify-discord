/**
 * Delay Generator Utility
 * min ~ max 초 범위의 랜덤 딜레이 생성
 */

export function getDelay(min: number, max?: number): number {
  if (min <= 0) {
    return 0;
  }
  if (!max || max <= min) {
    return min * 1000;
  }
  return Math.floor(Math.random() * ((max - min) * 1000 + 1)) + min * 1000;
}

/**
 * min ~ max 초 딜레이 부여
 * @param min 최소 초
 * @param max 최대 초
 * @returns min ~ max 초
 */
export function getDelay(min: number, max?: number) {
  if (min <= 0) {
    return 0;
  }
  if (!max || max <= min) {
    return min * 1000;
  }
  return Math.floor(Math.random() * ((max - min) * 1000 + 1)) + min * 1000;
};

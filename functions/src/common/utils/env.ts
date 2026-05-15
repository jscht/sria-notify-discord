/**
 * Environment Variable Helpers
 *
 * - requireEnv: 누락 시 throw → 모듈 로드 시점에 fail-fast
 * - optionalEnv: 없으면 undefined 반환 → 호출처에서 graceful degrade
 * - ENV: 중앙 집중식 접근 (오타 시 TS 컴파일 에러로 차단)
 */

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Missing required env: ${key}`);
  }
  return v;
}

export function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v && v.length > 0 ? v : undefined;
}

export const ENV = {
  // 공고 페이지 base URL. 누락 시 임베드는 링크 대신 대체 텍스트로 표시
  SRIA_URL: optionalEnv("SRIA_URL"),
} as const;

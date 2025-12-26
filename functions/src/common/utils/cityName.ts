/**
 * City Name Converter Utility
 * 영어 <-> 한국어 도시명 변환
 * 
 * 순환 참조 방지: constants에서 직접 import하지 않고 함수 내부에서 import
 */

/**
 * 영어 도시명을 한국어로 변환
 */
export function toKorean(cityName?: string | undefined): string | undefined {
  if (!cityName) return;

  // 동적 import로 순환 참조 방지
  const { CITIES } = require("@/common/constants");

  if (typeof cityName === "string" && Object.keys(CITIES).includes(cityName)) {
    return CITIES[cityName as keyof typeof CITIES];
  }

  return cityName;
}

/**
 * 한국어 도시명을 영어로 변환
 */
export function toEnglish(cityName?: string | undefined): string | undefined {
  if (!cityName) return;

  // 동적 import로 순환 참조 방지
  const { CITIES } = require("@/common/constants");

  if (typeof cityName === "string" && Object.values(CITIES).includes(cityName)) {
    const cityEntry = Object.entries(CITIES).find(([_, value]) => value === cityName);
    if (cityEntry) {
      return cityEntry[0];
    }
  }

  return cityName;
}

export const cityNameConverter = {
  toKorean,
  toEnglish,
};

/**
 * 유효한 도시명인지 확인
 */
export function isValidCityName(cityName: any): boolean {
  if (typeof cityName !== "string") {
    return false;
  }

  // 동적 import로 순환 참조 방지
  const { CITIES } = require("@/common/constants");

  const isKorean = (str: string) => /^[가-힣]+$/.test(str);

  if (isKorean(cityName)) {
    return Object.values(CITIES).includes(cityName);
  } else {
    return Object.keys(CITIES).includes(cityName);
  }
}

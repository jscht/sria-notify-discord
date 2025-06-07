import { CITIES } from "../constants/city";
import { CityEn, CityKo } from "../types/city";

export const cityNameConverter = {
  toKorean(cityName?: CityEn | CityKo): CityKo | undefined {
    if (!cityName) return;

    if (typeof cityName === "string" && Object.keys(CITIES).includes(cityName)) {
      return CITIES[cityName as CityEn];
    }

    return cityName as CityKo;
  },

  toEnglish(cityName?: CityEn | CityKo): CityEn | undefined {
    if (!cityName) return;

    if (typeof cityName === "string" && Object.values(CITIES).includes(cityName as CityKo)) {
      const cityEntry = Object.entries(CITIES).find(([_, value]) => value === cityName);
      if (cityEntry) {
        return cityEntry[0] as CityEn;
      }
    }

    return cityName as CityEn;
  },
};

export function isValidCityName(cityName: any): boolean {
  if (typeof cityName !== "string") {
    return false;
  }

  const isKorean = (str: string) => /^[가-힣]+$/.test(str);

  if (isKorean(cityName)) {
    return Object.values(CITIES).includes(cityName as CityKo);
  } else {
    return Object.keys(CITIES).includes(cityName as CityEn);
  }
}
import { CITIES } from "../constants/city";
import { CityKo, CityEn } from "../types/city.d";

export function isValidCityName(cityName: any): boolean {
  if (typeof cityName !== 'string') {
    return false;
  }

  const isKorean = (str: string) => /^[가-힣]+$/.test(str);

  if (isKorean(cityName)) {
    return Object.values(CITIES).includes(cityName as CityKo)
  } else {
    return Object.keys(CITIES).includes(cityName as CityEn);
  }
}

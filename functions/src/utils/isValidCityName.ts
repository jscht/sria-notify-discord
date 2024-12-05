import { CITY } from "../constants/city";
import { City } from "../types/city.d";

export function isValidCityName(cityName: any): boolean {
  if (typeof cityName !== 'string') {
    return false;
  }
  const validCities: City[] = Object.values(CITY);
  return validCities.includes(cityName as City);
}

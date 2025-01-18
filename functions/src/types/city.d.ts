import { CITIES } from "../constants/city";

export type CityEn = keyof typeof CITIES;
export type CityKo = typeof CITIES[CityEn];

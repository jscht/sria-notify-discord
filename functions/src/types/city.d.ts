import { CITY } from "../constants/city";

export type City = typeof CITY[keyof typeof CITY];

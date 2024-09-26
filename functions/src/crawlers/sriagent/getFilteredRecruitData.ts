import { Page } from "playwright";
import { City } from "../../types/city.d";
import { extractRecruitData } from "./extractRecruitData";

export async function getFilteredRecruitData(crawlData: Page, city?: City) {
  const result = await extractRecruitData(crawlData);
  if (!city) {
    return result;
  }
  else return result.filter((job) => job?.title?.includes(city));
};

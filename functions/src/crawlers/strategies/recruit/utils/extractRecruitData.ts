import "@/common/utils/systemLogger";
import { Page } from "playwright-core";
import type { RecruitData } from "@/crawlers/types";

export async function extractRecruitData(page: Page): Promise<RecruitData[]> {
  const normalizeWhitespace = (text: string) => text?.replace(/\s+/g, " ").trim();
  const elements = page.locator(".recruit_list ul > li");
  const itemCount = await elements.count();
  globalLogger.info(`Found ${itemCount} list items.`);

  const promises = Array.from({ length: itemCount }, async (_, i) => {
    const item = elements.nth(i);

    const { rawTitle, rawHref } = await item.locator(".recruit_tit .inner").evaluate((el) => ({
      rawTitle: el.textContent || "",
      rawHref: el.getAttribute("href") || "",
    }));

    const { rawDDay, rawDayTxt } = await item.locator(".recruit_tit .day_box").evaluate((el) => ({
      rawDDay: el.querySelector(".d_day")?.textContent || el.querySelector(".today")?.textContent || "",
      rawDayTxt: el.querySelector(".day_txt")?.textContent || "",
    }));

    const rawRecruitmentStatus = await item.locator(".recruit_badge em").textContent() || "";

    const title = normalizeWhitespace(rawTitle);
    const href = normalizeWhitespace(rawHref);
    const dDay = normalizeWhitespace(rawDDay);
    const dayTxt = normalizeWhitespace(rawDayTxt);
    const recruitmentStatus = normalizeWhitespace(rawRecruitmentStatus);

    return { href, title, dDay, dayTxt, recruitmentStatus } as RecruitData;
  });

  return await Promise.all(promises);
}

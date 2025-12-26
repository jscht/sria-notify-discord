import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { getDelay } from "../../../utils/getDelay";
import { getRandomUserAgent } from "../../../utils/getRandomUserAgent";
import { getList } from "./getList";

export async function proxyScraper() {
  chromium.use(stealth());

  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,  // 디버깅 시 false
  })
  .catch((error) => {
    throw error;
  });

  const context = await browser.newContext({
    userAgent: getRandomUserAgent(),
  })
  .catch((error) => {
    throw error;
  });

  try {
    const page = await context.newPage();

    const targetUrl = `${process.env.PROXY_URL}`;
    const pageWaitDelay = getDelay(7);

    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: pageWaitDelay
    })

    const proxies = await getList(page);

    return proxies;
  } catch (error) {
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

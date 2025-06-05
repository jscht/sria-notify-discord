import { Browser, Cookie } from "playwright-core";

const requiredCookies = ["XSRF-TOKEN", "dyms_career_session"];

export async function getCookie(browser: Browser) {
  const context = await browser.newContext()
  .catch((error) => {
    throw error;
  });

  try {
    const page = await context.newPage();

    const targetUrl = `${process.env.PROXY_URL}`;
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    const cookies = await context.cookies();

    const foundCookies = cookies
      .filter(cookie => requiredCookies.includes(cookie.name))
      .reduce<Cookie[]>((acc, cookie) => {
        acc.push(cookie);
        return acc;
      }, []);

    if (Object.keys(foundCookies).length !== requiredCookies.length) {
      return;
    }

    DebugLogger.server("Found all required cookies");
    return foundCookies;
  } catch (error) {
    throw error;
  } finally {
    await context.close();
  }
}
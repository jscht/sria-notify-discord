import "@/common/utils/systemLogger";
import { BrowserContext, Cookie } from "playwright-core";

const requiredCookies = ["XSRF-TOKEN", "dyms_career_session"];

/**
 * 프록시·stealth가 적용된 context로 saramin에 접속해 필수 세션 쿠키를 취득한다.
 *
 * Phase 1.10 변경:
 * - 시그니처를 `browser` → `context`로 변경 — 호출 측(SriaCrawler)이 프록시·ko-KR로
 *   만든 context를 그대로 사용해야 쿠키 취득 단계에서 실 IP가 노출되지 않는다.
 * - 접속 대상을 `PROXY_URL`(오접속 버그) → `SRIA_URL`(saramin)로 정합.
 * - context는 호출 측이 소유하므로 닫지 않는다(페이지만 정리).
 */
export async function getCookie(context: BrowserContext) {
  const page = await context.newPage();

  try {
    const targetUrl = `${process.env.SRIA_URL}`;
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

    globalLogger.info("Found all required cookies");
    return foundCookies;
  } catch (error) {
    throw error;
  } finally {
    await page.close();
  }
}

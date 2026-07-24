import { Events } from "discord.js";
import { providerLogger } from "@/common/utils/systemLogger";
import { client } from "./client";
import { markDiscordReady } from "./discordReady";
import { events } from "@/events/discordListeners";

/**
 * Discord 봇 초기화 — 게이트웨이 리스너 등록 + 로그인.
 *
 * `initializeProviders()`의 `Promise.all`에 들어가지만 **로그인 실패가 HTTP를 막지 않도록**
 * login을 try/catch로 감싸 항상 resolve한다(실패해도 throw 안 함). ready 시점은 별도 leaf
 * 모듈(`discordReady.ts`)의 빗장으로 알린다 — 성공(ClientReady)·실패(catch) 둘 다 빗장을 연다.
 */
export async function initDiscordBot(): Promise<void> {
  for (const { once, event, execute } of events) {
    if (once) {
      client.once(event, execute);
    } else {
      client.on(event, execute);
    }
  }

  // ready 빗장 — onReady(로깅)와 별개로 resolve 전용 once 리스너.
  client.once(Events.ClientReady, () => {
    markDiscordReady();
  });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);
  } catch (error) {
    // 로그인 실패가 HTTP·스케줄러를 막지 않도록 흡수. 빗장은 열되(무한대기 방지)
    // 실제 fetch는 실패 → dmSender 재시도 소진 → 실패 로그.
    providerLogger.error("Discord login failed (HTTP unaffected)", error as Error);
    markDiscordReady();
  }
}

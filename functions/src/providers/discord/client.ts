import { Client, GatewayIntentBits, REST } from "discord.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/** DM 발송 전용 REST 클라이언트 — gateway WS/login과 독립. 함수 프로세스가 사용. */
export const rest = new REST({ version: "10" });

/** REST 토큰 주입. 부트스트랩이 프로세스별로 호출(gateway 로그인과 무관). */
export function initDiscordRest(): void {
  rest.setToken(process.env.DISCORD_BOT_TOKEN!);
}

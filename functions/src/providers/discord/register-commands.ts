import { config } from "dotenv";
import { REST, Routes } from "discord.js";
import { commands } from "./commands";

config();

// 디스코드 Slash Command를 Discord API에 등록하는 용도
// 봇 실행(index.ts)과는 별개이며, 명령어가 추가/변경/삭제될 때만 수동 실행

const rest = new REST({ version: '10' }).setToken(process.env.SARIAN_BOT_TOKEN!);

(async () => {
  try {
    DebugLogger.provider("🔁 명령어 등록 중...", "discord");

    await rest.put(
      Routes.applicationGuildCommands(process.env.SARIAN_APP_ID!, process.env.SARIAN_TEST_GUILD_ID!),
      { body: commands.map(cmd => cmd.toJSON()) },
    );

    DebugLogger.provider("✅ 명령어 등록 완료!", "discord");
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("❌ 명령어 등록 실패:", error);
    }
  }
})();
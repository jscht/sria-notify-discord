import { SlashCommandBuilder, CommandInteraction } from "discord.js";
import { DiscordBotCommand } from ".";

export const postCommand = new SlashCommandBuilder()
  .setName(DiscordBotCommand.Post)
  .setDescription("해당 지역의 공고를 요청합니다.")
  .addStringOption(option =>
    option.setName("지역")
      .setDescription("조회할 지역명")
      .setRequired(true)
  );

export const handlePostCommand = async (interaction: CommandInteraction) => {
  const region = interaction.options.get("지역")?.value as string;

  try {
    await interaction.deferReply(); // 긴 요청일 경우 처리중 상태 표시

    // const response = await axios.get(`${process.env.API_BASE_URL}/notices?region=${encodeURIComponent(region)}`);

    // const notices = response.data;

    // if (!notices || notices.length === 0) {
    //   await interaction.editReply(`❌ \`${region}\` 지역에 대한 공고가 없습니다.`);
    //   return;
    // }

    // const reply = notices.slice(0, 5).map((notice: any, i: number) =>
    //   `**[${i + 1}]** ${notice.title} - ${notice.company} (${notice.date})\n<${notice.url}>`
    // ).join('\n\n');

    // await interaction.editReply(`📢 \`${region}\` 지역 공고:\n\n${reply}`);
    await interaction.editReply(`📢 \`${region}\` 지역 공고\n\n공고 내용...`);
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Error fetching posts:", error);
    }
    await interaction.editReply("⚠️ 공고 정보를 가져오는 데 실패했어요.");
  }
};

function replyMessage() {

}
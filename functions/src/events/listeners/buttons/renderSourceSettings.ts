import type { MessageComponentInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { sourceToggleButtons } from "@/providers/discord/builder/buttons/sourceToggleButtons";
import { sourceMenuBackButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { sourceDescriptions } from "@/providers/discord/builder/subscriptionSummary";

const SOURCE_SETTINGS_CONTENT = [
  "받을 공고를 켜거나 꺼 주세요",
  "버튼을 누르면 바로 저장돼요",
];

/**
 * 사이트 설정 화면(공고 묶음 버튼 + 뒤로 버튼)을 렌더한다.
 *
 * 호출 측은 이미 응답을 마친 상태를 전제로 한다.
 *
 * @param interaction 응답을 마친 버튼 인터랙션
 * @param sub 사용자 알림 구독 정보
 */
export async function renderSourceSettings(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
): Promise<void> {
  await interaction.editReply({
    content: [...SOURCE_SETTINGS_CONTENT, ...sourceDescriptions()].join("\n"),
    embeds: [],
    components: [sourceToggleButtons(sub.sources), sourceMenuBackButtons()],
  });
}

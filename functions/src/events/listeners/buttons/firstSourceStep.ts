import type { MessageComponentInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmSubscription } from "@/common/types";
import { firstSourceQuestionButtons } from "@/providers/discord/builder/buttons/firstSourceQuestionButtons";
import { buildSubscribeEntryView } from "@/providers/discord/builder/subscribeEntryView";
import { renderSubscribeManage } from "./renderSubscribeManage";

/**
 * 첫 구독의 사이트 질문 화면을 렌더한다.
 *
 * 지역 모드 버튼 핸들러가 새 문서를 만든 직후 부른다.
 * 문서는 사이트 "전체"로 이미 저장되어 있어, 메시지를 닫아도 모든 사이트의 공고를 받는다.
 *
 * @param interaction defer 완료된 컴포넌트 인터랙션
 * @param sub 방금 만든 구독 정보
 */
export async function renderFirstSourceQuestion(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
): Promise<void> {
  const firstLine = sub.regions.mode === AlertMode.SELECTED ?
    "✅ 알림을 켰어요. 사이트를 정한 다음 받을 지역을 추가해 주세요." :
    "✅ 모든 지역 알림이 설정되었어요.";

  await interaction.editReply({
    content: `${firstLine}\n어느 사이트의 공고를 받을까요? 지금은 모든 사이트의 공고를 받아요.`,
    embeds: [],
    components: [firstSourceQuestionButtons()],
  });
}

/**
 * 첫 구독의 사이트 단계를 마무리한다.
 *
 * 지역을 골라야 하는 구독자는 지역 화면으로, 아니면 진입 화면으로 보낸다.
 *
 * @param interaction defer 완료된 컴포넌트 인터랙션(버튼/셀렉트 메뉴)
 * @param sub 사용자 알림 구독 정보
 * @param notice 화면 맨 위에 보여 줄 안내 문구
 */
export async function finishFirstSourceStep(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
  notice: string,
): Promise<void> {
  if (sub.regions.mode === AlertMode.SELECTED) {
    await renderSubscribeManage(interaction, sub, notice);
    return;
  }

  const { content, components } = buildSubscribeEntryView(sub);
  await interaction.editReply({
    content: `${notice}\n\n${content}`,
    embeds: [],
    components,
  });
}

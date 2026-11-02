import type { MessageComponentInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import { buildSubscribeManageEmbed } from "@/providers/discord/builder/embeds/subscribeManageEmbed";

/**
 * 지역 화면(Embed + 지역 관리 버튼)을 렌더한다.
 *
 * 호출 측은 이미 `deferUpdate()` 된 상태를 전제로 한다.
 * 지역 설정 진입·모드변경 결과 복귀 등 여러 핸들러가 동일 화면을 재현하기 위해 공유한다.
 *
 * @param interaction defer 완료된 컴포넌트 인터랙션(버튼/셀렉트 메뉴)
 * @param sub 사용자 알림 구독 정보
 * @param notice Embed 위에 보여 줄 안내 문구. 없으면 content를 비운다
 */
export async function renderSubscribeManage(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
  notice?: string,
): Promise<void> {
  await interaction.editReply({
    content: notice ?? "",
    embeds: [buildSubscribeManageEmbed(sub)],
    components: subscribeManageButtons(sub),
  });
}

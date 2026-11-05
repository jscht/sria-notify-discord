import type { MessageComponentInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { AlertMode } from "@/common/types";
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

export const ALL_REGIONS_NOTICE =
  "지금은 모든 지역 알림을 받고 있어요. 지역을 고르려면 **🔀 모드 변경**을 눌러 주세요.";

/**
 * 지역 모드가 SELECTED가 아니면 지역 편집을 멈추고 지역 화면을 다시 그린다.
 *
 * 지역을 고르던 때 열어 둔 메시지에서 누르면 모드가 ALL이어도 여기까지 온다.
 * 이때 저장하면 `updateRegions`가 모드를 SELECTED로 바꿔 전체 지역 알림이 끊긴다.
 * 추가·제거 메뉴를 여는 버튼도 이 함수를 불러, 옛 화면이 첫 클릭에 지금 설정으로 바뀌게 한다.
 *
 * @returns 화면을 다시 그렸으면 true. 호출 측은 편집하지 않고 끝낸다
 */
export async function rerenderIfAllRegions(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
): Promise<boolean> {
  if (sub.regions.mode === AlertMode.SELECTED) return false;

  await renderSubscribeManage(interaction, sub, ALL_REGIONS_NOTICE);
  return true;
}

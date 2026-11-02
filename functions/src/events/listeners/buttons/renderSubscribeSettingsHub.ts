import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { MessageComponentInteraction } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import { subscribeSettingsHubButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { buildSubscribeManageEmbed } from "@/providers/discord/builder/embeds/subscribeManageEmbed";

/**
 * 설정 관리 화면(Embed + 지역·사이트 설정 버튼)을 렌더한다.
 *
 * 호출 측은 이미 `deferUpdate()` 된 상태를 전제로 한다.
 *
 * @param interaction defer 완료된 컴포넌트 인터랙션(버튼/셀렉트 메뉴)
 * @param sub 사용자 알림 구독 정보
 * @param notice Embed 위에 보여 줄 안내 문구. 없으면 content를 비운다
 */
export async function renderSubscribeSettingsHub(
  interaction: MessageComponentInteraction,
  sub: AlarmSubscription,
  notice?: string,
): Promise<void> {
  await interaction.editReply({
    content: notice ?? "",
    embeds: [buildSubscribeManageEmbed(sub)],
    components: [subscribeSettingsHubButtons()],
  });
}

/**
 * 구독 문서가 없는 사용자에게 안내 문구와 뒤로가기 버튼만 보여 준다.
 *
 * 호출 측은 이미 `deferUpdate()` 된 상태를 전제로 한다.
 *
 * @param interaction defer 완료된 컴포넌트 인터랙션(버튼/셀렉트 메뉴)
 */
export async function renderNoSubscription(
  interaction: MessageComponentInteraction,
): Promise<void> {
  await interaction.editReply({
    content: "아직 알림 설정이 없어요. '알림 켜기'로 시작해보세요.",
    embeds: [],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(subscribeOptionActionId.BACK)
          .setLabel("⬅️ 뒤로")
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  });
}

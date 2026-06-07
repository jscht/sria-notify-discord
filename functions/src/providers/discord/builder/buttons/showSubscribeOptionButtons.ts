import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import type { AlarmSubscription } from "@/common/types";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";

/**
 * 알림 설정 진입 화면의 옵션 버튼.
 *
 * 좌측 버튼은 현재 구독 활성 여부에 따라 분기한다.
 * - 활성: 🔕 알림 끄기 (DISABLE)
 * - 비활성/미설정: 🔔 알림 켜기 (ENABLE)
 * 우측 버튼은 항상 ⚙️ 설정 관리 (MANAGE).
 *
 * @param sub 사용자 알림 구독 정보 (없으면 null)
 */
export function showSubscribeOptionButtons(sub: AlarmSubscription | null) {
  const leftButton = sub?.enabled
    ? new ButtonBuilder()
        .setCustomId(subscribeOptionActionId.DISABLE)
        .setLabel("🔕 알림 끄기")
        .setStyle(ButtonStyle.Secondary)
    : new ButtonBuilder()
        .setCustomId(subscribeOptionActionId.ENABLE)
        .setLabel("🔔 알림 켜기")
        .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    leftButton,
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.MANAGE)
      .setLabel("⚙️ 설정 관리")
      .setStyle(ButtonStyle.Secondary),
  );
}

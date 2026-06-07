import { EmbedBuilder } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmSubscription } from "@/common/types";
import { selectedRegionContent } from "@/providers/discord/builder/buttons/formatRegionList";

/**
 * 구독 관리(MANAGE) 화면용 Embed.
 *
 * 현재 알림 설정(활성 여부 / 모드 / 선택 지역)을 요약해 가독성 있게 보여준다.
 * @param sub 사용자 알림 구독 정보
 */
export function buildSubscribeManageEmbed(sub: AlarmSubscription): EmbedBuilder {
  const modeLabel = sub.alertMode === AlertMode.ALL ? "🌐 전체 지역" : "📍 선택 지역";
  const statusLabel = sub.enabled ? "🔔 켜짐" : "🔕 꺼짐";

  const embed = new EmbedBuilder()
    .setTitle("🔧 내 알림 설정")
    .setColor(sub.enabled ? 0x00b0f4 : 0x99aab5)
    .addFields(
      { name: "알림 상태", value: statusLabel },
      { name: "알림 모드", value: modeLabel },
    );

  if (sub.alertMode === AlertMode.SELECTED) {
    embed.addFields({ name: "지역", value: selectedRegionContent(sub.regions) });
  }

  return embed;
}

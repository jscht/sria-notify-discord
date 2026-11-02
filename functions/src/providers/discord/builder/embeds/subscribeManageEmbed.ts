import { EmbedBuilder } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmSubscription } from "@/common/types";
import { selectedValues } from "@/common/utils/alarmFilter";
import { selectedRegionContent } from "@/providers/discord/builder/buttons/formatRegionList";
import { regionSummary, sourceSummary } from "@/providers/discord/builder/subscriptionSummary";

/**
 * 설정 관리 화면과 지역 화면이 함께 쓰는 Embed.
 *
 * 현재 알림 설정(활성 여부 / 지역 / 사이트)을 요약해 가독성 있게 보여준다.
 * @param sub 사용자 알림 구독 정보
 */
export function buildSubscribeManageEmbed(sub: AlarmSubscription): EmbedBuilder {
  const statusLabel = sub.enabled ? "🔔 켜짐" : "🔕 꺼짐";
  const regionLabel = sub.regions.mode === AlertMode.ALL ?
    `📍 ${regionSummary(sub.regions)}` :
    selectedRegionContent(selectedValues(sub.regions));

  return new EmbedBuilder()
    .setTitle("🔧 내 알림 설정")
    .setColor(sub.enabled ? 0x00b0f4 : 0x99aab5)
    .addFields(
      { name: "알림 상태", value: statusLabel },
      { name: "지역", value: regionLabel },
      { name: "사이트", value: `🌐 ${sourceSummary(sub.sources)}` },
    );
}

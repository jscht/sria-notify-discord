import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { AlertMode } from "@/common/types";
import type { AlarmSubscription } from "@/common/types";
import { showSubscribeOptionButtons } from "@/providers/discord/builder/buttons/showSubscribeOptionButtons";
import { formatRegionList } from "@/providers/discord/builder/buttons/formatRegionList";

/**
 * 알림 설정 진입 화면(content + 옵션 버튼)을 구성한다.
 *
 * 현재 구독 상태를 한 줄 요약으로 보여주고, 상태에 맞는 옵션 버튼을 함께 반환한다.
 * 진입 리스너와 끄기/뒤로가기 핸들러가 동일한 화면을 재현하기 위해 공유한다.
 *
 * @param sub 사용자 알림 구독 정보 (없으면 null)
 */
export function buildSubscribeEntryView(sub: AlarmSubscription | null): {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  let content: string;

  if (sub?.enabled && sub.alertMode === AlertMode.ALL) {
    content = "🔔 알림 **켜짐** · 🌐 전체 지역";
  } else if (sub?.enabled && sub.alertMode === AlertMode.SELECTED) {
    content = `🔔 알림 **켜짐** · 📍 ${formatRegionList(sub.regions)}`;
  } else if (sub && !sub.enabled) {
    content = "🔕 알림 **꺼짐** — 다시 켜려면 '알림 켜기'를 눌러주세요.";
  } else {
    content = "🔔 알림을 시작하거나 설정을 변경할 수 있어요.";
  }

  return {
    content,
    components: [showSubscribeOptionButtons(sub)],
  };
}

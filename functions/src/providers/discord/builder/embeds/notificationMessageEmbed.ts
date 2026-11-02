import { APIEmbed, EmbedBuilder } from "discord.js";
import type { AlarmSubscription, RecruitDisplay } from "@/common/types";
import { AlertMode } from "@/common/types";
import { regionSummary } from "@/providers/discord/builder/subscriptionSummary";
import { formatRecruitGroups } from "./recruitList";

/** 사이트마다 임베드 description에 표시할 상위 공고 개수. 초과분은 꼬리줄로 요약한다. */
const TOP_COUNT = 3;

/** DM에는 모집이 끝난 공고도 들어가므로 정렬 기준을 항상 안내한다. */
const SORT_NOTICE = "접수 중인 공고를 먼저 보여드려요. 모집이 끝난 공고는 목록 아래쪽에 있어요.";

/**
 * 배너(푸시 알림) 요약용 message.content를 생성한다. (Phase 1.9 iterate §7)
 *
 * 임베드 필드 개행은 푸시 배너에 실리지 않으므로, 배너에 노출할 요약을
 * content 평문 2줄로 구성한다(개행 유지됨).
 * ```
 * 📢 {지역요약} · 총 {N}건
 *  ▽ 아래 목록에서 확인하세요
 * ```
 *
 * @param displays 구독 조건에 맞는 공고 전체
 * @param settings 사용자 알림 구독 설정 (지역 라벨 조립용)
 * @returns 배너용 2줄 평문 문자열
 */
export function notificationBannerContent(
  displays: RecruitDisplay[],
  settings: AlarmSubscription
): string {
  return [
    `📢 ${regionSummary(settings.regions, "·")} · 총 ${displays.length}건`,
    " ▽ 아래 목록에서 확인하세요",
  ].join("\n");
}

/**
 * 알림 DM용 임베드를 생성한다.
 *
 * 헤더(title/description) 역할은 배너 content가 담당하므로 임베드에는 두지 않는다.
 * description에 사이트별 상위 3건을 간단히 모드로 나열한다.
 * 임베드 필드 값은 1024자 한도라 넘칠 수 있어 description(4096자) 하나에 모두 넣는다.
 * footer.text는 개행을 지원하지 않으므로 안내문도 description 하단에 둔다.
 *
 * @param displays 구독 조건에 맞는 공고 전체. 접수중 → 발표중 → 종료, 같은 상태 안 최신순으로 정렬되어 있다
 * @param settings 사용자 알림 구독 설정 (지역 안내문 조건 판단용)
 * @returns 알림용 임베드 JSON
 */
export function notificationMessageEmbed(
  displays: RecruitDisplay[],
  settings: AlarmSubscription
): APIEmbed {
  const { blocks, hasOverflow } = formatRecruitGroups(displays, {
    detail: "simple",
    topCount: TOP_COUNT,
  });
  const sections = [...blocks];

  // 지역을 골라 구독했고 넘친 공고가 있을 때만: 전체 공고엔 선택 외 지역도 섞일 수 있음을 안내.
  if (settings.regions.mode === AlertMode.SELECTED && hasOverflow) {
    sections.push("지역 필터로 조회된 공고예요\n전체 공고에는 다른 지역도 포함돼요");
  }
  sections.push(SORT_NOTICE);

  return new EmbedBuilder()
    .setColor(0x00b0f4)
    .setTimestamp()
    .setDescription(sections.join("\n\n"))
    .toJSON();
}

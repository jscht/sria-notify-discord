import { CITIES } from "@/common/constants/city";
import { AlertMode } from "@/common/types";
import type { AlarmFilter, AlarmSubscription, RecruitSource } from "@/common/types";
import {
  activeRegions,
  getSourceToggles,
  isToggleOn,
  type SourceToggle,
} from "@/providers/recruit/sourceToggle";

/**
 * 구독 지역을 사용자에게 보일 요약 문구로 바꾼다. 꺼진 공고의 지역은 넣지 않는다.
 *
 * @param sub 구독자의 지역·사이트 필터
 * @param separator 지역 이름 사이 구분자 (DM 배너는 "·")
 * @returns "전체 지역" | "서울, 부산" | "선택된 지역 없음"
 */
export function regionSummary(
  sub: Pick<AlarmSubscription, "regions" | "sources">,
  separator = ", "
): string {
  if (sub.regions.mode === AlertMode.ALL) return "전체 지역";

  const regions = activeRegions(sub);
  if (regions.length === 0) return "선택된 지역 없음";
  return regions.map((region) => CITIES[region]).join(separator);
}

/**
 * 사이트 필터를 사용자에게 보일 요약 문구로 바꾼다.
 *
 * @param filter 구독자 사이트 필터
 * @returns "모든 공고" | "일반 공고" | "elias 공고" | "받을 공고 없음"
 */
export function sourceSummary(filter: AlarmFilter<RecruitSource>): string {
  if (filter.mode === AlertMode.ALL) return "모든 공고";

  const names = getSourceToggles()
    .filter((toggle) => isToggleOn(toggle, filter))
    .map((toggle) => toggle.label);

  return names.length > 0 ? names.join(", ") : "받을 공고 없음";
}

/**
 * 공고 설명을 Discord 인용 블록으로 만든다. 사이트 설정 화면과 권역 메뉴가 함께 쓴다.
 *
 * @param toggles 설명할 공고 묶음. 기본값은 묶음 전체
 * @returns 공고 묶음마다 한 줄
 */
export function sourceDescriptions(toggles: SourceToggle[] = getSourceToggles()): string[] {
  return toggles.map(({ label, description }) => `> ${label}: ${description}`);
}

import { CITIES } from "@/common/constants/city";
import { AlertMode } from "@/common/types";
import type { AlarmFilter, CityEn, RecruitSource } from "@/common/types";
import { getSourceConfig, getUserFacingSources } from "@/providers/recruit";

/**
 * 지역 필터를 사용자에게 보일 요약 문구로 바꾼다.
 *
 * @param filter 구독자 지역 필터
 * @param separator 지역 이름 사이 구분자 (DM 배너는 "·")
 * @returns "전체 지역" | "서울, 부산" | "선택된 지역 없음"
 */
export function regionSummary(filter: AlarmFilter<CityEn>, separator = ", "): string {
  if (filter.mode === AlertMode.ALL) return "전체 지역";
  if (filter.values.length === 0) return "선택된 지역 없음";
  return filter.values.map((region) => CITIES[region]).join(separator);
}

/**
 * 사이트 필터를 사용자에게 보일 요약 문구로 바꾼다.
 *
 * SELECTED 값 중 노출 사이트만 이름으로 바꿔 잇는다.
 *
 * @param filter 구독자 사이트 필터
 * @returns "모든 사이트" | "sria" | "받을 사이트 없음"
 */
export function sourceSummary(filter: AlarmFilter<RecruitSource>): string {
  if (filter.mode === AlertMode.ALL) return "모든 사이트";

  const visible = new Set(getUserFacingSources());
  const names = filter.values
    .filter((source) => visible.has(source))
    .map((source) => getSourceConfig(source).displayName);

  return names.length > 0 ? names.join(", ") : "받을 사이트 없음";
}

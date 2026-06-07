import { CITIES } from "@/common/constants/city";
import type { CityEn } from "@/common/types";
import { MAX_REGION_COUNT } from "@/features/alarmSubscribe/commands/slashCommand";

/**
 * CITIES(en→ko)의 역방향 매핑(ko→en).
 * ko 값이 유니크하므로 충돌 없이 1:1 역매핑이 성립한다.
 * 모듈 로드 시 1회만 구성한다.
 */
const KO_TO_CITY_EN: Record<string, CityEn> = Object.fromEntries(
  (Object.entries(CITIES) as [CityEn, string][]).map(([en, ko]) => [ko, en])
);

/**
 * 선택된 지역 목록을 한글로 변환하여 사용자용 안내 문자열로 만든다.
 * @param regions 선택된 지역(CityEn) 배열
 * @returns 빈 배열이면 "선택된 지역이 없습니다.", 아니면 "현재 선택 지역: {한글, ...}"
 */
export function formatRegionList(regions: CityEn[]): string {
  if (regions.length === 0) {
    return "선택된 지역이 없습니다.";
  }
  const ko = regions.map((r) => CITIES[r]).join(", ");
  return `현재 선택 지역: ${ko}`;
}

/**
 * SELECTED 편집/관리 화면용 안내 — 선택 목록 + 최대 지역 수 안내.
 * 0개일 때는 알림이 발송되지 않는다는 경고와 설정 권유를 보여준다.
 */
export function selectedRegionContent(regions: CityEn[]): string {
  if (regions.length === 0) {
    return [
      "⚠️ 선택된 지역이 없어 알림이 발송되지 않아요.",
      "지역을 추가해 알림 받을 지역을 설정해 주세요.",
      `(최대 ${MAX_REGION_COUNT}개까지 선택 가능)`,
    ].join("\n");
  }
  return `${formatRegionList(regions)}\n(최대 ${MAX_REGION_COUNT}개까지 선택 가능)`;
}

/**
 * 한글 지역명을 CityEn으로 역변환한다.
 * @param ko 한글 지역명 (예: "서울")
 * @returns 대응하는 CityEn (예: "seoul"), 미존재 입력은 null
 */
export function koToCityEn(ko: string): CityEn | null {
  return KO_TO_CITY_EN[ko] ?? null;
}

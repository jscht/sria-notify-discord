import { CITIES } from "@/common/constants/city";
import type { CityEn } from "@/common/types";
import { MAX_REGION_COUNT } from "@/features/alarmSubscribe/commands/slashCommand";
import type { ToggleRegions } from "@/providers/recruit/sourceToggle";

/**
 * CITIES(en→ko)의 역방향 매핑(ko→en).
 * ko 값이 유니크하므로 충돌 없이 1:1 역매핑이 성립한다.
 * 모듈 로드 시 1회만 구성한다.
 */
const KO_TO_CITY_EN: Record<string, CityEn> = Object.fromEntries(
  (Object.entries(CITIES) as [CityEn, string][]).map(([en, ko]) => [ko, en])
);

/**
 * SELECTED 편집/관리 화면용 안내 — 공고별 선택 목록 + 최대 지역 수 안내.
 * 전체 0개일 때는 알림이 발송되지 않는다는 경고와 설정 권유를 보여준다.
 * 일부 공고만 0개이면 그 공고의 알림이 오지 않으므로 줄을 남겨 알린다.
 *
 * @param groups 켜진 공고별로 나눈 지역
 * @returns 화면에 보여 줄 여러 줄 문구
 */
export function selectedRegionContent(groups: ToggleRegions[]): string {
  const limit = `(공고별 최대 ${MAX_REGION_COUNT}개까지 선택 가능)`;

  if (groups.every(({ regions }) => regions.length === 0)) {
    return [
      "⚠️ 선택된 지역이 없어 알림이 발송되지 않아요.",
      "지역을 추가해 알림 받을 지역을 설정해 주세요.",
      limit,
    ].join("\n");
  }

  return [
    "현재 선택 지역",
    ...groups.map(({ toggle, regions }) => {
      const names = regions.map((region) => `\`${CITIES[region]}\``).join(" ");
      return `> ${toggle.label}: ${names || "선택한 지역 없음"}`;
    }),
    limit,
  ].join("\n");
}

/**
 * 한글 지역명을 CityEn으로 역변환한다.
 * @param ko 한글 지역명 (예: "서울")
 * @returns 대응하는 CityEn (예: "seoul"), 미존재 입력은 null
 */
export function koToCityEn(ko: string): CityEn | null {
  return KO_TO_CITY_EN[ko] ?? null;
}

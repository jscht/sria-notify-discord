/**
 * City Filter Utility
 *
 * Phase 1.10 재정의: 소스 로딩(더미 JSON/모드)은 프로바이더 계층으로 이관되고,
 * 본 유틸은 **순수 도시 필터**만 담당한다.
 */

import type { Recruit } from "@/common/types";

/**
 * 공고 목록을 도시 이름으로 필터링하는 순수 함수.
 * @param list 공고 목록
 * @param city 한글 지명(없으면 전체 반환)
 */
export function filterListByCity(list: Recruit[], city?: string): Recruit[] {
  if (!city) {
    return list;
  }
  return list.filter(({ title }) => title.includes(city));
}

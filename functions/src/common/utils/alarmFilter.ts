import type { AlarmFilter } from "@/common/types";
import { AlertMode } from "@/common/types";

/**
 * 필터의 현재 선택 목록을 읽는다 (Pure Function)
 *
 * UI가 `sub.regions`·`sub.sources`를 배열로 읽을 때 쓴다.
 *
 * @param filter 구독 조건 하나(지역 또는 소스)
 * @returns SELECTED면 `values`, ALL이면 빈 배열
 */
export function selectedValues<T>(filter: AlarmFilter<T>): T[] {
  return filter.mode === AlertMode.SELECTED ? filter.values : [];
}

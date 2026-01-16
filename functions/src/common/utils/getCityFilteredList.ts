/**
 * City Filtered List Utility
 * 도시별로 공고 목록을 필터링
 */

import type { RecruitData } from "@/crawlers/types";
import { CRAWL_MODE } from "../constants";

// TODO: common에 맞는 유틸리티인지 검토 필요
export async function getCityFilteredList(
  mode: string, 
  city?: string, 
  recruitList?: RecruitData[]
): Promise<RecruitData[]> {
  const sourceList = await getRecruitSource(mode, recruitList);
  return filterListByCity(sourceList, city);
}

/**
 * 1. 데이터 소스로부터 공고 목록을 가져오는 함수
 * (모드에 따라 더미 데이터 또는 전달받은 리스트 반환)
 */
async function getRecruitSource(
  mode: string, 
  recruitList?: RecruitData[]
): Promise<RecruitData[]> {
  if (mode === CRAWL_MODE.DUMMY) {
    try {
      const { default: dummyList } = await import("@/test/mocks/sriagent/sample-recruit-list.json");
      return dummyList as RecruitData[];
    } catch (error) {
      if (error instanceof Error) {
        globalLogger.error("Failed to load dummy data:", error);
      }
      return [];
    }
  }

  if (!Array.isArray(recruitList)) {
    throw new Error("recruitList is required in CRAWL mode.");
  }

  return recruitList;
}

/**
 * 2. 공고 목록을 도시 이름으로 필터링하는 함수 (Pure Function)
 */
export function filterListByCity(list: RecruitData[], city?: string): RecruitData[] {
  if (!city) {
    return list;
  }
  return list.filter(({ title }) => title.includes(city));
}

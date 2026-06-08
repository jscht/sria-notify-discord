/**
 * Recruit Filter Utility
 *
 * 자동 알림(Phase 1.7)에서 사용하는 모드/지역 필터 순수 함수.
 * 구독자의 알림 모드(전체/선택)와 지역에 따라 새 공고(Job[])를 거른다.
 */

import type { Job, AlarmSubscription, CityEn } from "@/common/types";
import { AlertMode } from "@/common/types";
import { toKorean } from "@/common/utils/cityName";

/**
 * 지역 필터 (Pure Function)
 *
 * `filterListByCity`(common/utils/getCityFilteredList.ts)와 동일한
 * `title.includes(한글지명)` 정책을 Job[]·복수 지역으로 확장한 어댑터.
 * `filterListByCity`는 RecruitData[]·단일 city 시그니처라 Job[]에 직접 적용 시
 * Job.id 손실 + 복수 지역 처리가 불가하여 별도 함수로 분리한다.
 * (정책 출처를 본 JSDoc에 명시하여 드리프트 방지)
 *
 * @param jobs 대상 공고 목록
 * @param regions 구독자 지역 목록 (영문 CityEn)
 * @returns 지역에 매칭되는 공고만. 지역이 비어 있으면 빈 배열.
 */
export function filterByRegion(jobs: Job[], regions: CityEn[]): Job[] {
  if (regions.length === 0) return [];

  const koreanNames = regions
    .map((region) => toKorean(region))
    .filter((name): name is string => Boolean(name));

  return jobs.filter((job) =>
    koreanNames.some((koreanName) => job.value.title.includes(koreanName))
  );
}

/**
 * 모드 필터 (Pure Function)
 *
 * - `AlertMode.ALL` → 전체 공고 대상
 * - `AlertMode.SELECTED` → 구독자 지역에 매칭되는 공고만
 *
 * @param jobs 대상 공고 목록
 * @param subscription 구독자 알림 설정
 * @returns 모드에 따라 필터링된 공고 목록
 */
export function filterByMode(jobs: Job[], subscription: AlarmSubscription): Job[] {
  return subscription.alertMode === AlertMode.ALL
    ? jobs
    : filterByRegion(jobs, subscription.regions);
}

/**
 * Recruit Filter Utility
 *
 * 알림 발송 판정에서 사용하는 필터·정렬 순수 함수.
 * 필터는 서로를 모른다. 모두 Job[]을 받아 걸러진 Job[]을 돌려주고 순서를 유지한다.
 * `common`은 `providers`를 import하지 않으므로 노출 소스 목록은 인자로 받는다.
 */

import type {
  AlarmFilter,
  CityEn,
  Job,
  Recruit,
  RecruitSource,
  RecruitmentStatus,
} from "@/common/types";
import { AlertMode } from "@/common/types";
import { toKorean } from "@/common/utils/cityName";

/**
 * ① 숨긴 소스 제외 (Pure Function)
 *
 * 발송 1회에 한 번만 호출한다.
 *
 * @param jobs 대상 공고 목록
 * @param visible 사용자에게 보이는 소스
 * @returns 보이는 소스의 공고만
 */
export function filterVisibleSources(jobs: Job[], visible: ReadonlySet<RecruitSource>): Job[] {
  return jobs.filter((job) => visible.has(job.value.source));
}

/**
 * ③ 소스 필터 (Pure Function)
 *
 * @param jobs 대상 공고 목록
 * @param filter 구독자 소스 필터
 * @returns ALL이면 그대로, SELECTED면 고른 소스의 공고만
 */
export function filterBySource(jobs: Job[], filter: AlarmFilter<RecruitSource>): Job[] {
  if (filter.mode === AlertMode.ALL) return jobs;
  const wanted = new Set(filter.values);
  return jobs.filter((job) => wanted.has(job.value.source));
}

/**
 * 공고 제목에 지역 이름이 들어 있는지로 거른다.
 *
 * `filterListByCity`(common/utils/getCityFilteredList.ts)와 동일한
 * `title.includes(한글지명)` 정책을 Job[]·복수 지역으로 확장한 어댑터.
 * `filterListByCity`는 Recruit[]·단일 city 시그니처라 Job[]에 직접 적용 시
 * Job.id 손실 + 복수 지역 처리가 불가하여 별도 함수로 분리한다.
 * (정책 출처를 본 JSDoc에 명시하여 드리프트 방지)
 *
 * @param jobs 대상 공고 목록
 * @param regions 구독자 지역 목록 (영문 CityEn)
 * @returns 지역에 매칭되는 공고만. 지역이 비어 있으면 빈 배열.
 */
function matchRegions(jobs: Job[], regions: CityEn[]): Job[] {
  if (regions.length === 0) return [];

  const koreanNames = regions
    .map((region) => toKorean(region))
    .filter((name): name is string => Boolean(name));

  return jobs.filter((job) =>
    koreanNames.some((koreanName) => job.value.title.includes(koreanName))
  );
}

/**
 * ④ 지역 필터 (Pure Function)
 *
 * @param jobs 대상 공고 목록
 * @param filter 구독자 지역 필터
 * @returns ALL이면 그대로, SELECTED면 제목에 고른 지역이 있는 공고만 (지역 0개면 빈 배열)
 */
export function filterByRegion(jobs: Job[], filter: AlarmFilter<CityEn>): Job[] {
  if (filter.mode === AlertMode.ALL) return jobs;
  return matchRegions(jobs, filter.values);
}

/**
 * 공고의 시작 날짜를 읽는다 (Pure Function)
 *
 * 시각은 보지 않는다.
 *
 * @param recruit 공고
 * @returns `"YYYY.MM.DD"`. 형식이 맞지 않으면 빈 문자열이라 최신순 정렬에서 맨 뒤로 간다
 */
export function getStartDate(recruit: Recruit): string {
  const period = (() => {
    switch (recruit.source) {
    case "sria": return recruit.dayTxt;
    case "elias": return recruit.period;
    default: {
      const unknownSource: never = recruit; // 소스를 추가하면 여기서 컴파일 오류
      return unknownSource;
    }
    }
  })();
  return /^\d{4}\.\d{2}\.\d{2}/.exec(period)?.[0] ?? "";
}

/**
 * 시작 날짜 최신순으로 정렬한다 (Pure Function)
 *
 * `YYYY.MM.DD` 글자는 사전순이 날짜순과 같아 글자로 비교한다.
 * 같은 날짜는 원래 순서를 유지한다(Array.prototype.sort는 안정 정렬).
 *
 * @param items 정렬 대상. 원본은 바꾸지 않는다
 * @param toRecruit 항목에서 공고를 꺼내는 함수
 * @returns 정렬된 새 배열
 */
export function sortByStartDateDesc<T>(items: T[], toRecruit: (item: T) => Recruit): T[] {
  return [...items].sort((a, b) =>
    getStartDate(toRecruit(b)).localeCompare(getStartDate(toRecruit(a)))
  );
}

/**
 * 공고의 모집 상태를 읽는다 (Pure Function)
 *
 * 소스마다 상태 필드 이름이 달라 여기서 한 번에 읽는다.
 *
 * @param recruit 공고
 * @returns 모집 상태
 */
export function getRecruitStatus(recruit: Recruit): RecruitmentStatus {
  switch (recruit.source) {
  case "sria": return recruit.recruitmentStatus;
  case "elias": return recruit.status;
  default: {
    const unknownSource: never = recruit; // 소스를 추가하면 여기서 컴파일 오류
    return unknownSource;
  }
  }
}

/** 알림 정렬의 상태 순서. 작을수록 앞에 온다. */
const STATUS_ORDER: Record<RecruitmentStatus, number> = { 접수중: 0, 발표중: 1, 종료: 2 };

/**
 * ② 알림 정렬 (Pure Function)
 *
 * 접수중 → 발표중 → 종료, 같은 상태 안에서는 시작 날짜 최신순.
 * 최신순으로 정렬한 뒤 상태로 다시 정렬하며, 안정 정렬이라 같은 상태 안의 최신순이 유지된다.
 * 발송 1회에 한 번만 호출한다.
 *
 * @param jobs 대상 공고 목록
 * @returns 정렬된 새 배열
 */
export function sortForNotification(jobs: Job[]): Job[] {
  return sortByStartDateDesc(jobs, (job) => job.value).sort(
    (a, b) => STATUS_ORDER[getRecruitStatus(a.value)] - STATUS_ORDER[getRecruitStatus(b.value)]
  );
}

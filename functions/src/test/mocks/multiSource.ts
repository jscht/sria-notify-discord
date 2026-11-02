/**
 * 여러 사이트 테스트용 공고 생성 함수.
 *
 * sria는 고정 값으로, elias는 `generateEliasRecruits(고정 시각, eliasConfig)`로 만든다.
 * `providers/recruit/index.ts`를 거치지 않으므로 이 파일만으로는 `REDIS_URL`이 필요하지 않다.
 */

import type { EliasRecruit, Job, Recruit, SriaRecruit } from "@/common/types";
import { eliasConfig } from "@/providers/recruit/elias/eliasMockConfig";
import { generateEliasRecruits } from "@/providers/recruit/elias/eliasRule";

/** 테스트 기준 시각. 2026-10-11 14:00 (한국 시간). */
export const FIXED_NOW = Date.UTC(2026, 9, 11, 5, 0, 0);

/** `findEliasNow`가 살펴보는 회차 수 (30분 × 480회 = 10일). */
const SEARCH_LIMIT = 480;

/** 공고를 `Job`으로 감싼다. */
export function toJob(recruit: Recruit): Job {
  return { id: recruit.id, value: recruit };
}

/**
 * sria 공고를 만든다.
 *
 * @param localId 사이트 안 번호. 공고 ID는 `sria:{localId}`가 된다
 * @param overrides 바꿀 값
 * @returns 기본값에 `overrides`를 덮어쓴 공고
 */
export function makeSriaRecruit(
  localId: number,
  overrides: Partial<SriaRecruit> = {}
): SriaRecruit {
  return {
    id: `sria:${localId}`,
    source: "sria",
    title: `[서울] sria 공고 ${localId}`,
    postedBy: "테스트 게시자",
    url: `https://example.com/jobs/${localId}`,
    dayTxt: "2026.10.01 ~ 2026.10.15",
    dDay: "D-7",
    recruitmentStatus: "접수중",
    ...overrides,
  };
}

/** sria `Job`을 만든다. 인자는 `makeSriaRecruit`과 같다. */
export function makeSriaJob(localId: number, overrides: Partial<SriaRecruit> = {}): Job {
  return toJob(makeSriaRecruit(localId, overrides));
}

/**
 * `FIXED_NOW`부터 회차를 넘기며 접수중 elias 공고가 충분한 첫 시각을 찾는다.
 *
 * 생성 규칙이 결정적이라 설정이 같으면 항상 같은 시각을 돌려준다.
 *
 * @param minOpen 필요한 접수중 공고 수
 * @returns 조건에 맞는 시각(epoch ms)
 * @throws 살펴본 범위에 조건에 맞는 시각이 없을 때
 */
export function findEliasNow(minOpen = 2): number {
  for (let i = 0; i < SEARCH_LIMIT; i++) {
    const now = FIXED_NOW + i * eliasConfig.unitMs;
    const open = generateEliasRecruits(now, eliasConfig).filter(
      (recruit) => recruit.status === "접수중"
    );
    if (open.length >= minOpen) return now;
  }
  throw new Error(`접수중 elias 공고가 ${minOpen}건 이상인 시각을 찾지 못함`);
}

/**
 * elias 공고 목록을 결정적으로 만든다.
 *
 * @param now 기준 시각. 없으면 접수중 공고가 2건 이상인 시각
 * @returns 그 시각에 살아 있는 elias 공고
 */
export function makeEliasRecruits(now: number = findEliasNow()): EliasRecruit[] {
  return generateEliasRecruits(now, eliasConfig);
}

/** elias `Job` 목록을 만든다. 인자는 `makeEliasRecruits`와 같다. */
export function makeEliasJobs(now: number = findEliasNow()): Job[] {
  return makeEliasRecruits(now).map(toJob);
}

/**
 * 값을 정해 둔 elias 공고 하나를 만든다.
 *
 * 생성 규칙으로 만든 접수중 공고를 바탕으로 `id`와 `overrides`만 바꾼다.
 *
 * @param localId 공고 ID 구분 번호. 공고 ID는 `elias:{localId}`가 된다
 * @param overrides 바꿀 값
 * @returns 공고
 */
export function makeEliasRecruit(
  localId: number,
  overrides: Partial<EliasRecruit> = {}
): EliasRecruit {
  const base = makeEliasRecruits().find((recruit) => recruit.status === "접수중");
  if (!base) throw new Error("접수중 elias 공고가 없음");
  return { ...base, id: `elias:${localId}`, ...overrides };
}

/** elias `Job`을 만든다. 인자는 `makeEliasRecruit`과 같다. */
export function makeEliasJob(localId: number, overrides: Partial<EliasRecruit> = {}): Job {
  return toJob(makeEliasRecruit(localId, overrides));
}

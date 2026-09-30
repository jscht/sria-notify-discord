import type { Recruit, RecruitSource } from "@/common/types";

/**
 * 공고 소스 프로바이더. (Phase 1.10 — "하나의 API 소스" 추상화)
 *
 * 목/실 API 무관하게 이 계약만 지키면 `RecruitSourceService`가 병합·격리한다.
 * 반환값은 `Recruit`(사이트별 타입의 합집합)를 만족한다.
 */
export interface RecruitProvider {
  /** 소스 식별자 — 로그·라우팅·diff 파티션 키. */
  readonly source: RecruitSource;

  /** 소스에서 공고 목록을 가져온다. 실패 시 throw → 상위가 소스별로 격리. */
  fetch(): Promise<Recruit[]>;
}

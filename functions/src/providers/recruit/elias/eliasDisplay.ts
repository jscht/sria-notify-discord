import type { EliasRecruit, RecruitDisplay } from "@/common/types";

/**
 * elias 공고를 공통 표시 형식으로 바꾼다 (Pure Function)
 *
 * `index.ts`와 서로 import하는 순환을 피하려고 표시 이름은 인자로 받는다.
 *
 * @param r elias 공고
 * @param label 사이트 표시 이름 (`SourceConfig.displayName`)
 * @returns 공통 표시 형식. `fields`는 `extraFields`로 그대로 넘긴다
 */
export function eliasToDisplay(r: EliasRecruit, label: string): RecruitDisplay {
  return {
    source: "elias",
    sourceLabel: label,
    title: r.title,
    postedBy: r.postedBy,
    period: r.period,
    status: r.status,
    extraFields: r.fields,
  };
}

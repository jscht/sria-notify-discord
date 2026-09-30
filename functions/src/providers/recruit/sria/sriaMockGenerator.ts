import type { SriaRecruit } from "@/common/types";
import { ENV } from "@/common/utils";
import { toHref } from "./href";
import { sriaConfig, type SriaMockConfig } from "./sriaMockConfig";

/**
 * sria 생성기 — 일반(소스 반영). (Phase 1.10)
 *
 * 규칙 없이 값 pool 기반 현재 스냅샷을 반환한다(실 API 응답 모사).
 * 변화 감지는 전적으로 diff 엔진에 위임. id는 소스 네임스페이스 포함.
 */
export function generateSriaRecruits(config: SriaMockConfig = sriaConfig): SriaRecruit[] {
  const base = ENV.SRIA_URL ?? "";
  return config.postings.map((p, i) => {
    const localId = config.idBase + i;
    const href = toHref(localId);
    return {
      id: `sria:${localId}`,
      source: "sria",
      title: p.title,
      url: base ? `${base}${href}` : href,
      dDay: p.dDay,
      dayTxt: p.dayTxt,
      recruitmentStatus: p.recruitmentStatus,
    };
  });
}

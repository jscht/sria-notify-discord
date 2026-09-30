import type { Recruit } from "@/common/types";
import type { RecruitProvider } from "../RecruitProvider";
import { generateSriaRecruits } from "./sriaMockGenerator";

/**
 * sria 프로바이더 — 일반 사이트(스냅샷 반영, 규칙 없음).
 */
export class SriaMockProvider implements RecruitProvider {
  readonly source = "sria" as const;

  async fetch(): Promise<Recruit[]> {
    return generateSriaRecruits();
  }
}

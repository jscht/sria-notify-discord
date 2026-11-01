import type { Recruit } from "@/common/types";
import type { RecruitProvider } from "../RecruitProvider";
import { generateEliasRecruits } from "./eliasRule";
import { eliasConfig } from "./eliasMockConfig";

/**
 * elias 프로바이더 — 커스텀 규칙 사이트(§규칙 엔진).
 */
export class EliasMockProvider implements RecruitProvider {
  readonly source = "elias" as const;

  async fetch(): Promise<Recruit[]> {
    return generateEliasRecruits(Date.now(), eliasConfig);
  }
}

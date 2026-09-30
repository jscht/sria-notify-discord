import type { Recruit } from "@/common/types";
import type { RecruitProvider } from "../RecruitProvider";
import { generateTempRecruits } from "./tempRule";
import { tempConfig } from "./tempMockConfig";

/**
 * temp 프로바이더 — 커스텀 규칙 사이트(§규칙 엔진). 이름 임시.
 */
export class TempMockProvider implements RecruitProvider {
  readonly source = "temp" as const;

  async fetch(): Promise<Recruit[]> {
    return generateTempRecruits(Date.now(), tempConfig);
  }
}

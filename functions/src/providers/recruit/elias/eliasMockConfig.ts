import { eliasTitles } from "./eliasTitles";
import { eliasFields } from "./eliasFields";
import type { EliasRuleConfig } from "./eliasRule";

/**
 * elias 사이트 설정. 규칙 파라미터 + 데이터(제목/속성) import. (Phase 1.10)
 * `intervalMinutes`는 스케줄 주기의 단일 출처(배포 시점 확정 → 변경 시 redeploy).
 * ※ `unitMs`(틱 크기)와는 별개 개념 — 우연히 값만 같다.
 */
export interface EliasConfig extends EliasRuleConfig {
  intervalMinutes: number;
}

export const eliasConfig: EliasConfig = {
  intervalMinutes: 30,
  unitMs: 30 * 60_000, // 시간 한 칸(틱) = 30분
  lifespanTicks: 24, // 모집 기간 12시간
  spawnProbs: { 1: 0.45, 2: 0.12, 3: 0.03 }, // 나머지 40%는 0개
  closeProb: 0.1, // 접수중 → 종료 (수정)
  deleteProb: 0.05, // 목록에서 제거
  titles: eliasTitles,
  fields: eliasFields,
};

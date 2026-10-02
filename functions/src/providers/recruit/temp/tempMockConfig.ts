import { tempTitles } from "./tempTitles";
import { tempFields } from "./tempFields";
import type { TempRuleConfig } from "./tempRule";

/**
 * temp 사이트 설정. 규칙 파라미터 + 데이터(제목/속성) import. (Phase 1.10)
 * `intervalMinutes`는 스케줄 주기의 단일 출처(배포 시점 확정 → 변경 시 redeploy).
 * ※ `unitMs`(틱 크기)와는 별개 개념 — 우연히 값만 같다.
 */
export interface TempConfig extends TempRuleConfig {
  intervalMinutes: number;
}

export const tempConfig: TempConfig = {
  intervalMinutes: 30,
  unitMs: 30 * 60_000, // 시간 한 칸(틱) = 30분
  lifespanTicks: 48, // 기본 모집기간 = 48틱(=24시간)
  spawnProbs: { 1: 0.4, 2: 0.1, 3: 0.02 }, // 1개 40% · 2개 10% · 3개 2% (나머지 0)
  editProb: 0.3, // 30% 확률로 내용 수정
  deleteProb: 0.1, // 10% 확률로 조기 삭제
  titles: tempTitles,
  fields: tempFields,
};

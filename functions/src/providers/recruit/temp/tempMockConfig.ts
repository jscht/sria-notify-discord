import { tempTitles } from "./tempTitles";
import { tempFields } from "./tempFields";
import type { TempRuleConfig } from "./tempRule";

/**
 * temp 사이트 설정. 규칙 파라미터 + 데이터(제목/속성) import. (Phase 1.10)
 * `schedule`은 Firebase 스케줄 주기(배포 시점 확정 → 변경 시 redeploy).
 */
export interface TempConfig extends TempRuleConfig {
  schedule: string;
}

export const tempConfig: TempConfig = {
  schedule: "every 30 minutes",
  unitMs: 30 * 60_000, // 시간 한 칸(틱) = 30분
  lifespanTicks: 48, // 기본 모집기간 = 48틱(=24시간)
  spawnProbs: { 1: 0.4, 2: 0.1, 3: 0.02 }, // 1개 40% · 2개 10% · 3개 2% (나머지 0)
  editProb: 0.3, // 30% 확률로 내용 수정
  deleteProb: 0.1, // 10% 확률로 조기 삭제
  titles: tempTitles,
  fields: tempFields,
};

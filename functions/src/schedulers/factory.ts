import { RecruitScheduler } from "./RecruitScheduler";
import { toIntervalMs } from "./utils/interval";
import { getSourceConfig } from "@/providers/recruit";
import type { RecruitSource } from "@/common/types";

/**
 * 소스별 Recruit 스케줄러 팩토리. (scheduler Factory refactor)
 *
 * 싱글턴 대신 호출 시마다 새 인스턴스를 생성해 반환한다.
 * 주기는 소스 config의 `intervalMinutes` 하나에서 파생 → 루프/서버리스 경로 일관.
 * `getProvider(source)` 관례에 맞춘 모듈 함수 형태.
 */
export function createRecruitScheduler(source: RecruitSource): RecruitScheduler {
  const { intervalMinutes } = getSourceConfig(source);
  return new RecruitScheduler(source, toIntervalMs(intervalMinutes));
}

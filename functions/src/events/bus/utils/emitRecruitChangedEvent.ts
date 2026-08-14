import "@/common/utils/systemLogger";
import { eventBus } from "../EventBus";
import { EventType } from "../types";
import type { RecruitChangedEvent } from "../types";
import type { JobDiffResult } from "@/common/types/job.d";

/**
 * RECRUIT_CHANGED 발행 공용 헬퍼 — 두 발행부(사용자 백업 write·스케줄러 crawlAndDiff)가
 * 동일 payload 조립 + try-catch 방어(발행 실패가 캐시 성공을 막지 않음)를 공유.
 * CHANGED gating은 호출 측이 담당한다.
 *
 * @param diff 공고 변경 사항 (added/updated/deleted)
 * @param source 발행 출처 식별 문자열
 * @param opts.awaitSettle true면 emitEventAndSettle await(틱 완결), false면 fire-and-forget.
 */
export async function emitRecruitChangedEvent(
  diff: JobDiffResult,
  source: string,
  opts: { awaitSettle: boolean }
): Promise<void> {
  const payload: RecruitChangedEvent = { timestamp: Date.now(), source, ...diff };
  try {
    if (opts.awaitSettle) {
      await eventBus.emitEventAndSettle<RecruitChangedEvent>(EventType.RECRUIT_CHANGED, payload);
    } else {
      eventBus.emitEvent<RecruitChangedEvent>(EventType.RECRUIT_CHANGED, payload);
    }
  } catch (error) {
    globalLogger.error("RECRUIT_CHANGED 이벤트 발행 실패", error as Error, { source });
  }
}

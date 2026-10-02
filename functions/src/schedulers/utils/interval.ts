/**
 * 주기 단일 출처 파생 유틸. (scheduler Factory refactor)
 *
 * 소스 config는 `intervalMinutes` 숫자 하나만 보유하고,
 * onSchedule 표현식과 상시 루프용 ms를 모두 여기서 파생한다.
 * → 주기가 한 곳에서만 정의되어 루프/서버리스 경로가 어긋나지 않는다.
 */

/**
 * intervalMinutes 값 검증 — 1 이상의 정수여야 한다.
 * 설정 실수(0·음수·소수·NaN)를 파생 전에 조기 차단한다.
 */
function assertValidMinutes(intervalMinutes: number): void {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1) {
    throw new Error(
      `intervalMinutes must be an integer >= 1, got: ${intervalMinutes}`
    );
  }
}

/**
 * Firebase onSchedule 표현식 파생.
 * 60분으로 나누어떨어지면 `every N hours`, 아니면 `every N minutes`.
 */
export function toScheduleExpression(intervalMinutes: number): string {
  assertValidMinutes(intervalMinutes);
  if (intervalMinutes % 60 === 0) {
    return `every ${intervalMinutes / 60} hours`;
  }
  return `every ${intervalMinutes} minutes`;
}

/** 상시 루프(setTimeout 재스케줄)용 밀리초 파생. */
export function toIntervalMs(intervalMinutes: number): number {
  assertValidMinutes(intervalMinutes);
  return intervalMinutes * 60_000;
}

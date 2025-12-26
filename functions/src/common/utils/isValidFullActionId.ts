/**
 * Full Action ID Validator Utility
 * Discord 상호작용 ID의 유효성 검증
 */

// TODO: events/fullActionId.ts가 common으로 이동하면 import 경로 수정 필요
// 임시로 any 타입 사용

export function isValidFullActionId(id: string): boolean {
  // TODO: fullActionId 객체의 모든 값이 포함되어 있는지 확인
  // 현재는 문자열 형식이 유효한지만 체크
  return typeof id === "string" && id.length > 0;
}

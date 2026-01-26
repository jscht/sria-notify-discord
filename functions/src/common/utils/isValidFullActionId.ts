/**
 * Full Action ID Validator Utility
 * Discord 상호작용 ID의 유효성 검증
 */

import { FullActionId, fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";

export function isValidFullActionId(id: unknown): id is FullActionId {
  // 1. 문자열 타입 및 길이 체크
  if (typeof id !== "string" || id.length === 0) {
    return false;
  }

  // 2. 정의된 객체의 값들에 포함되어 있는지 확인
  const validIds = Object.values(fullActionId) as readonly string[];
  
  return validIds.includes(id);
}
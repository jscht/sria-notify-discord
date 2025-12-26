/**
 * Alarm Subscribe Feature - Intent Definitions
 * 이 기능에서 인식 가능한 사용자 의도 정의
 */

export const ALARM_INTENTS = {
  SUBSCRIBE: "subscribe",           // "알람 켜줘", "구독하고 싶어"
  UNSUBSCRIBE: "unsubscribe",       // "알람 꺼줘", "구독 취소"
  UPDATE: "update",                 // "지역 변경", "알람 수정"
  CHECK_STATUS: "check_status",     // "현재 설정 확인", "뭐가 켜져있어?"
} as const;

export type AlarmIntent = typeof ALARM_INTENTS[keyof typeof ALARM_INTENTS];

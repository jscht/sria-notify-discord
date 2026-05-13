import type { CityEn } from "./city.d";

/**
 * 알림 모드 — 값과 타입의 단일 진실 공급원
 *
 * `as const` 객체 + 파생 union type 패턴:
 * - 값 변경 시 한 줄 수정으로 전 사용처 자동 갱신
 * - `AlertMode.SELECTED` 형태로 enum과 유사하게 사용
 * - 트리쉐이킹 가능, 별도 enum 메타데이터 없음
 */
export const AlertMode = {
  ALL: "ALL",
  SELECTED: "SELECTED",
} as const;
export type AlertMode = typeof AlertMode[keyof typeof AlertMode];

/**
 * 사용자 알림 구독 정보 (canonical)
 *
 * Firestore 문서: `users/{userId}/notifications/settings`
 * timestamps는 ms 단위 number (애플리케이션 경계).
 * Firestore Timestamp 변환은 SubscriptionStore가 담당.
 */
export interface AlarmSubscription {
  userId: string;
  enabled: boolean;
  alertMode: AlertMode;
  regions: CityEn[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 생성/업데이트 입력값
 * userId, createdAt, updatedAt은 store가 채움
 */
export type AlarmSubscriptionInput = Pick<
  AlarmSubscription,
  "enabled" | "alertMode" | "regions"
>;

import type { CityEn } from "./city.d";
import type { RecruitSource } from "./recruit.d";

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
 * 구독 조건 하나(지역 또는 소스)의 공통 모양.
 *
 * `mode` 값은 버튼 ID(`alertModeSelectActionId`)와 같은 값을 쓰기 위해 `AlertMode`를 재사용한다.
 * `values`의 "최소 1개"는 타입으로 강제하지 않는다.
 * 지역은 "선택 지역 + 0개" 상태가 정상 흐름에 있고, 이때 알림은 0건이다.
 */
export type AlarmFilter<T> =
  | { mode: typeof AlertMode.ALL }
  | { mode: typeof AlertMode.SELECTED; values: T[] };

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
  regions: AlarmFilter<CityEn>;
  sources: AlarmFilter<RecruitSource>;
  createdAt: number;
  updatedAt: number;
}

/**
 * 생성/업데이트 입력값
 * userId, createdAt, updatedAt은 store가 채움
 */
export type AlarmSubscriptionInput = Pick<AlarmSubscription, "enabled" | "regions" | "sources">;

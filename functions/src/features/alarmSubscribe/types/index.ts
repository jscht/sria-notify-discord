/**
 * Alarm Subscribe Feature Types
 */

// "ALL" 또는 "SELECTED_REGIONS"로 명확히 정의
export type SubscribeCommand = "ALL" | "SELECTED_REGIONS";

export interface AlarmSubscription {
  userId: string;
  mode: SubscribeCommand;
  regions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AlarmSubscriptionInput {
  mode: SubscribeCommand;
  regions?: string[];
}

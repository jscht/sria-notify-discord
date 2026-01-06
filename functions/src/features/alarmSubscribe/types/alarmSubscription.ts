import { SubscribeCommand } from "./alarmSubscribeCommand";

export interface AlarmSubscriptionInput {
  mode: SubscribeCommand;
  regions?: string[];
}

export interface AlarmSubscription extends AlarmSubscriptionInput {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

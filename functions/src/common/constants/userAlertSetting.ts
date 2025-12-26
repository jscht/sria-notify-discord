import { SubscribeCommand } from "./alarmSubscribeCommand"

export type SubscribeStatus = SubscribeCommand | null;

export interface UserAlertSetting {
  userId: string
  regions: string[]
  mode: SubscribeStatus
}

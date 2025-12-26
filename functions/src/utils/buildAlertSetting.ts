import { SubscribeCommand } from "../constants/alarmSubscribeCommand";
import { UserAlertSetting } from "../events/listeners/commands/onAlarmSubscribe";

export function buildAlertSetting(
  userId: string,
  regions: string[],
  currentMode: SubscribeCommand,
  requestedMode: SubscribeCommand
): UserAlertSetting {
  return {
    userId,
    regions,
    // 현재와 다른 모드로 구독할 시 미리 UI에 안내하고 모드 바꿔버림
    // 예전에 설정해둔 지역을 남겨 놓는다고 하면 모드만 변경
    mode: currentMode === requestedMode ? currentMode : requestedMode,
  };
}
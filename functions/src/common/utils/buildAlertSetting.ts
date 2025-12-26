/**
 * Alert Setting Builder Utility
 * 사용자 알림 설정 객체 생성
 * 
 * 순환 참조 방지: 런타임에 필요한 타입만 사용
 */

export interface AlertSettingInput {
  userId: string;
  regions: string[];
  currentMode: string;
  requestedMode: string;
}

export interface AlertSettingOutput {
  userId: string;
  regions: string[];
  mode: string;
}

export function buildAlertSetting(
  userId: string,
  regions: string[],
  currentMode: string,
  requestedMode: string
): AlertSettingOutput {
  return {
    userId,
    regions,
    // 현재와 다른 모드로 구독할 시 미리 UI에 안내하고 모드 바꿔버림
    // 예전에 설정해둔 지역을 남겨 놓는다고 하면 모드만 변경
    mode: currentMode === requestedMode ? currentMode : requestedMode,
  };
}

export const SUBSCRIBE_OPTION_PREFIX = "SUBSCRIBE_OPTION" as const;

export enum SubscribeOptionAction {
  ENABLE = "ENABLE",   // 구독 시작 및 알림 활성화
  MANAGE = "MANAGE",   // 구독 상태 및 지역 설정 관리
  DISABLE = "DISABLE", // 알림 비활성화
  BACK = "BACK"        // 진입 화면으로 복귀
}

export const subscribeOptionActionId = {
  ENABLE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.ENABLE}`,
  MANAGE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.MANAGE}`,
  DISABLE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.DISABLE}`,
  BACK: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.BACK}`
} as const;

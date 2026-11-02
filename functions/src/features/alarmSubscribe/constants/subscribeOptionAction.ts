export const SUBSCRIBE_OPTION_PREFIX = "SUBSCRIBE_OPTION" as const;

export enum SubscribeOptionAction {
  ENABLE = "ENABLE", // 구독 시작 및 알림 활성화
  MANAGE = "MANAGE", // 설정 관리 화면 (구독 상태, 지역·사이트 설정 진입)
  REGION = "REGION", // 지역 설정 화면
  DISABLE = "DISABLE", // 알림 비활성화
  BACK = "BACK" // 진입 화면으로 복귀
}

export const subscribeOptionActionId = {
  ENABLE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.ENABLE}`,
  MANAGE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.MANAGE}`,
  REGION: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.REGION}`,
  DISABLE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.DISABLE}`,
  BACK: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.BACK}`,
} as const;

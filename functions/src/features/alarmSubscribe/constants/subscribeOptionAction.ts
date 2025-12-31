export const SUBSCRIBE_OPTION_PREFIX = "SUBSCRIBE_OPTION" as const;

export enum SubscribeOptionAction {
  ENABLE = "ENABLE",  // 구독 시작 및 알림 활성화
  MANAGE = "MANAGE"   // 구독 상태 및 지역 설정 관리
}

export const subscribeOptionActionId = {
  ENABLE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.ENABLE}`,
  MANAGE: `${SUBSCRIBE_OPTION_PREFIX}:${SubscribeOptionAction.MANAGE}`
} as const;

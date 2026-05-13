import type { AlarmSubscription, AlarmSubscriptionInput, AlertMode, CityEn } from "@/common/types";

/**
 * Alarm Subscription Service
 * 사용자의 알림 구독 정보를 관리하는 비즈니스 로직
 *
 * 본 클래스의 메서드 본문은 Phase 1.5에서 `SubscriptionStore` 호출로 구현 예정.
 * Phase 1.4 범위는 타입 시그니처 정합화까지.
 */
export class AlarmSubscriptionService {
  /**
   * 사용자의 현재 알림 모드 조회
   */
  async getUserAlertMode(userId: string): Promise<AlertMode | null> {
    // TODO Phase 1.5: SubscriptionStore.getNotificationSettings → alertMode
    return null;
  }

  /**
   * 사용자 알림 구독
   */
  async subscribe(userId: string, input: AlarmSubscriptionInput): Promise<AlarmSubscription> {
    // TODO Phase 1.5: SubscriptionStore.setNotificationSettings
    throw new Error("Not implemented");
  }

  /**
   * 사용자 알림 구독 취소
   */
  async unsubscribe(userId: string): Promise<void> {
    // TODO Phase 1.5: SubscriptionStore.toggleNotificationEnabled(userId, false)
  }

  /**
   * 사용자의 알림 모드 업데이트
   */
  async updateMode(userId: string, alertMode: AlertMode): Promise<AlarmSubscription> {
    // TODO Phase 1.5: SubscriptionStore.updateAlertMode + 후속 조회
    throw new Error("Not implemented");
  }

  /**
   * 사용자의 지역 설정 업데이트
   */
  async updateRegions(userId: string, regions: CityEn[]): Promise<AlarmSubscription> {
    // TODO Phase 1.5: SubscriptionStore.updateAlertRegions + 후속 조회
    throw new Error("Not implemented");
  }

  /**
   * 사용자의 전체 구독 정보 조회
   */
  async getSubscription(userId: string): Promise<AlarmSubscription | null> {
    // TODO Phase 1.5: SubscriptionStore.getNotificationSettings
    return null;
  }
}

export const alarmSubscriptionService = new AlarmSubscriptionService();

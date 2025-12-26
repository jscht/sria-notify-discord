import type { AlarmSubscription, AlarmSubscriptionInput, SubscribeCommand } from "../types";

/**
 * Alarm Subscription Service
 * 사용자의 알림 구독 정보를 관리하는 비즈니스 로직
 */
export class AlarmSubscriptionService {
  /**
   * 사용자의 현재 알림 모드 조회
   */
  async getUserAlertMode(userId: string): Promise<SubscribeCommand | null> {
    // TODO: Firebase Firestore에서 사용자의 알림 모드 조회
    return null;
  }

  /**
   * 사용자 알림 구독
   */
  async subscribe(userId: string, input: AlarmSubscriptionInput): Promise<AlarmSubscription> {
    // TODO: Firebase Firestore에 구독 정보 저장
    // - userId, mode, regions, createdAt, updatedAt 저장
    throw new Error("Not implemented");
  }

  /**
   * 사용자 알림 구독 취소
   */
  async unsubscribe(userId: string): Promise<void> {
    // TODO: Firebase Firestore에서 구독 정보 삭제
  }

  /**
   * 사용자의 알림 모드 업데이트
   */
  async updateMode(userId: string, mode: SubscribeCommand): Promise<AlarmSubscription> {
    // TODO: Firebase Firestore에서 모드 업데이트
    throw new Error("Not implemented");
  }

  /**
   * 사용자의 지역 설정 업데이트
   */
  async updateRegions(userId: string, regions: string[]): Promise<AlarmSubscription> {
    // TODO: Firebase Firestore에서 지역 설정 업데이트
    throw new Error("Not implemented");
  }

  /**
   * 사용자의 전체 구독 정보 조회
   */
  async getSubscription(userId: string): Promise<AlarmSubscription | null> {
    // TODO: Firebase Firestore에서 전체 구독 정보 조회
    return null;
  }
}

export const alarmSubscriptionService = new AlarmSubscriptionService();

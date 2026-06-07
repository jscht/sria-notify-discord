import type { AlarmSubscription, AlarmSubscriptionInput, AlertMode, CityEn } from "@/common/types";
import { AlertMode as AlertModeValue } from "@/common/types";
import { SystemError } from "@/common/utils";
import { eventBus, EventType } from "@/events/bus";
import type { NotificationSubscribeEvent, NotificationUnsubscribeEvent } from "@/events/bus/types";
import { SubscriptionStore } from "@/providers/firebase/store/subscription";

const EVENT_SOURCE = "AlarmSubscriptionService" as const;

/**
 * Alarm Subscription Service
 * 사용자의 알림 구독 정보를 관리하는 비즈니스 로직 (CQS 오케스트레이션)
 *
 * `SubscriptionStore`의 쓰기 메서드는 전부 `void`(CQS)이므로, 갱신된 상태가
 * 필요한 메서드는 쓰기 직후 `getNotificationSettings`로 재조회해 반환한다.
 * 부분 업데이트(`updateAlertMode`/`updateAlertRegions`)는 문서 선존재 전제이므로
 * `ensureExists`로 사전 보장한다(design §2.1·§2.2).
 *
 * 핸들러 → 서비스 → Store 단방향. 서비스는 Store만 호출한다.
 */
export class AlarmSubscriptionService {
  private readonly store = new SubscriptionStore();

  /**
   * 사용자의 현재 알림 모드 조회. 구독 문서가 없으면 null.
   */
  async getUserAlertMode(userId: string): Promise<AlertMode | null> {
    try {
      const settings = await this.store.getNotificationSettings(userId);
      return settings?.alertMode ?? null;
    } catch (error) {
      throw SystemError.firestoreError("알림 모드 조회 실패", error as Error, { userId });
    }
  }

  /**
   * 사용자의 전체 구독 정보 조회. 문서가 없으면 null.
   */
  async getSubscription(userId: string): Promise<AlarmSubscription | null> {
    try {
      return await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("구독 정보 조회 실패", error as Error, { userId });
    }
  }

  /**
   * 사용자 알림 구독 (신규 활성화 또는 덮어쓰기).
   *
   * set은 void이므로 후속 조회로 최종 상태를 반환한다.
   * 쓰기 성공 후 `NOTIFICATION_SUBSCRIBE` 이벤트를 1회 발행한다.
   */
  async subscribe(userId: string, input: AlarmSubscriptionInput): Promise<AlarmSubscription> {
    let saved: AlarmSubscription | null;
    try {
      await this.store.setNotificationSettings(userId, input);
      saved = await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("구독 저장 실패", error as Error, { userId });
    }
    if (!saved) {
      throw SystemError.firestoreError("구독 저장 직후 조회 실패", undefined, { userId });
    }

    eventBus.emitEvent<NotificationSubscribeEvent>(EventType.NOTIFICATION_SUBSCRIBE, {
      timestamp: Date.now(),
      source: EVENT_SOURCE,
      userId,
      settings: saved,
    });

    return saved;
  }

  /**
   * 사용자의 알림 모드 업데이트 (기존 구독자의 설정 변경).
   *
   * 부분 업데이트이므로 `ensureExists`로 선존재를 보장한다.
   * 설정 변경이므로 이벤트는 발행하지 않는다(design §2.1).
   */
  async updateMode(userId: string, alertMode: AlertMode): Promise<AlarmSubscription> {
    await this.ensureExists(userId);

    let updated: AlarmSubscription | null;
    try {
      await this.store.updateAlertMode(userId, alertMode);
      updated = await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("알림 모드 업데이트 실패", error as Error, { userId });
    }
    if (!updated) {
      throw SystemError.firestoreError("알림 모드 업데이트 직후 조회 실패", undefined, { userId });
    }
    return updated;
  }

  /**
   * 사용자의 지역 설정 업데이트 (기존 구독자의 설정 변경).
   *
   * 부분 업데이트이므로 `ensureExists`로 선존재를 보장한다.
   * 설정 변경이므로 이벤트는 발행하지 않는다(design §2.1).
   */
  async updateRegions(userId: string, regions: CityEn[]): Promise<AlarmSubscription> {
    await this.ensureExists(userId);

    let updated: AlarmSubscription | null;
    try {
      await this.store.updateAlertRegions(userId, regions);
      updated = await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("지역 업데이트 실패", error as Error, { userId });
    }
    if (!updated) {
      throw SystemError.firestoreError("지역 업데이트 직후 조회 실패", undefined, { userId });
    }
    return updated;
  }

  /**
   * 사용자 알림 구독 해제 (활성화 플래그만 끔, 문서 삭제 아님).
   *
   * 구독한 적 없는 사용자(문서 미존재)는 "이미 해제 상태"로 간주해 조용히 null 반환.
   * 문서가 존재하면 비활성화 후 `NOTIFICATION_UNSUBSCRIBE` 이벤트를 발행하고,
   * 갱신 후 상태를 로컬 합성해 반환한다(post-write read 1회 절감).
   * `updatedAt`은 store가 server timestamp로 덮어쓰지만 UI는 표시하지 않으므로 안전.
   */
  async unsubscribe(userId: string): Promise<AlarmSubscription | null> {
    let existing: AlarmSubscription | null;
    try {
      existing = await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("구독 해제 전 조회 실패", error as Error, { userId });
    }
    // 문서 미존재 → 이미 해제 상태로 간주, 문서 생성 금지
    if (!existing) return null;

    try {
      await this.store.toggleNotificationEnabled(userId, false);
    } catch (error) {
      throw SystemError.firestoreError("구독 해제 실패", error as Error, { userId });
    }

    eventBus.emitEvent<NotificationUnsubscribeEvent>(EventType.NOTIFICATION_UNSUBSCRIBE, {
      timestamp: Date.now(),
      source: EVENT_SOURCE,
      userId,
    });

    return { ...existing, enabled: false, updatedAt: Date.now() };
  }

  /**
   * 구독 재활성화 (꺼짐 → 켜짐). `unsubscribe`의 정확한 역 — 플래그만 다시 켠다.
   *
   * `subscribe`(전체 문서 set+merge 덮어쓰기)와 달리 `enabled`만 토글하므로
   * 기존 `alertMode`/`regions`를 그대로 보존한다(문서 선존재 전제 — 호출 측에서 보장).
   * 재활성화는 라이프사이클 전이이므로 `subscribe`와 동일하게 `NOTIFICATION_SUBSCRIBE`를 발행한다.
   */
  async resubscribe(userId: string): Promise<AlarmSubscription> {
    let updated: AlarmSubscription | null;
    try {
      await this.store.toggleNotificationEnabled(userId, true);
      updated = await this.store.getNotificationSettings(userId);
    } catch (error) {
      throw SystemError.firestoreError("구독 재활성화 실패", error as Error, { userId });
    }
    if (!updated) {
      throw SystemError.firestoreError("구독 재활성화 직후 조회 실패", undefined, { userId });
    }

    eventBus.emitEvent<NotificationSubscribeEvent>(EventType.NOTIFICATION_SUBSCRIBE, {
      timestamp: Date.now(),
      source: EVENT_SOURCE,
      userId,
      settings: updated,
    });

    return updated;
  }

  /**
   * 부분 업데이트 전 문서 선존재 보장 (read-before-write, design §2.2).
   *
   * 문서가 있으면 그대로 반환, 없으면 기본값으로 생성 후 재조회해 반환한다.
   * 부분 업데이트(`update()`)가 문서 미존재 시 던지는 Firestore NOT_FOUND를 사전 차단한다.
   */
  private async ensureExists(userId: string): Promise<AlarmSubscription> {
    let existing: AlarmSubscription | null;
    try {
      existing = await this.store.getNotificationSettings(userId);
      if (existing) return existing;

      const defaults: AlarmSubscriptionInput = {
        enabled: true,
        alertMode: AlertModeValue.ALL,
        regions: [],
      };
      await this.store.setNotificationSettings(userId, defaults);
      const created = await this.store.getNotificationSettings(userId);
      if (!created) {
        throw SystemError.firestoreError("기본 구독 생성 직후 조회 실패", undefined, { userId });
      }
      return created;
    } catch (error) {
      if (error instanceof SystemError) throw error;
      throw SystemError.firestoreError("구독 문서 선존재 보장 실패", error as Error, { userId });
    }
  }
}

export const alarmSubscriptionService = new AlarmSubscriptionService();

import "@/common/utils/systemLogger";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { providerLogger } from "@/common/utils/systemLogger";
import type {
  AlarmSubscription,
  AlarmSubscriptionInput,
  AlertMode,
  CityEn,
} from "@/common/types";
import { FirebaseCollection } from "../constants/collections";

const SETTINGS_DOC_ID = "settings" as const;

/**
 * Firestore 문서 → AlarmSubscription 변환 헬퍼
 * Timestamp → number(ms) 변환을 store 경계 한 곳에서 수행
 */
function toAlarmSubscription(
  userId: string,
  data: FirebaseFirestore.DocumentData
): AlarmSubscription {
  return {
    userId,
    enabled: data.enabled,
    alertMode: data.alertMode,
    regions: data.regions ?? [],
    createdAt: (data.createdAt as Timestamp).toMillis(),
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
  };
}

/**
 * 사용자 알림 구독 설정 저장소
 *
 * Firestore 경로: `users/{userId}/notifications/settings`
 * 외부 코드는 항상 `number` ms 타임스탬프를 보고, Firestore Timestamp 변환은 본 클래스가 담당.
 */
export class SubscriptionStore {
  private readonly db = getFirestore();

  constructor() {}

  private getSettingsRef(userId: string) {
    return this.db
      .collection(FirebaseCollection.USERS).doc(userId)
      .collection(FirebaseCollection.NOTIFICATIONS).doc(SETTINGS_DOC_ID);
  }

  /**
   * 알림 설정 조회. 문서 없으면 null 반환 (자동 생성 X).
   */
  async getNotificationSettings(userId: string): Promise<AlarmSubscription | null> {
    const snap = await this.getSettingsRef(userId).get();
    if (!snap.exists) return null;
    return toAlarmSubscription(userId, snap.data()!);
  }

  /**
   * 알림 설정 신규 생성 또는 덮어쓰기 (쓰기 전용 — CQS).
   * - 신규: createdAt/updatedAt 모두 현재 시각
   * - 기존: createdAt 보존, updatedAt 갱신
   *
   * @remarks 저장 직후 상태가 필요하면 호출자가 `getNotificationSettings`를 호출한다.
   */
  async setNotificationSettings(
    userId: string,
    input: AlarmSubscriptionInput
  ): Promise<void> {
    const ref = this.getSettingsRef(userId);
    const now = Timestamp.now();
    const snap = await ref.get();

    const docData = snap.exists
      ? { ...input, updatedAt: now }
      : { ...input, createdAt: now, updatedAt: now };

    await ref.set(docData, { merge: true });
    providerLogger.info("Notification settings saved", {
      userId,
      alertMode: input.alertMode,
      enabled: input.enabled,
    });
  }

  /**
   * 알림 모드만 부분 업데이트.
   *
   * @remarks 문서 선존재 전제 — `setNotificationSettings`로 먼저 생성돼 있어야 함.
   *   `update()`는 문서가 없으면 NOT_FOUND를 throw → `createdAt` 누락 문서 생성을 차단.
   */
  async updateAlertMode(userId: string, alertMode: AlertMode): Promise<void> {
    await this.getSettingsRef(userId).update({ alertMode, updatedAt: Timestamp.now() });
  }

  /**
   * 알림 지역 목록만 부분 업데이트.
   *
   * @remarks 문서 선존재 전제 — `setNotificationSettings` 선행 필수. 없으면 NOT_FOUND throw.
   */
  async updateAlertRegions(userId: string, regions: CityEn[]): Promise<void> {
    await this.getSettingsRef(userId).update({ regions, updatedAt: Timestamp.now() });
  }

  /**
   * 알림 활성화 여부만 부분 업데이트.
   *
   * @remarks 문서 선존재 전제 — `setNotificationSettings` 선행 필수. 없으면 NOT_FOUND throw.
   */
  async toggleNotificationEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.getSettingsRef(userId).update({ enabled, updatedAt: Timestamp.now() });
  }

  /**
   * 활성화된 모든 구독자 조회 (collectionGroup 쿼리)
   * Phase 1.7 자동 알림 발송 기반
   */
  async getAllActiveSubscribers(): Promise<AlarmSubscription[]> {
    const snapshot = await this.db
      .collectionGroup(FirebaseCollection.NOTIFICATIONS)
      .where("enabled", "==", true)
      .get();

    return snapshot.docs
      .filter(doc => doc.id === SETTINGS_DOC_ID)
      .map(doc => {
        const userId = doc.ref.parent.parent!.id;
        return toAlarmSubscription(userId, doc.data());
      });
  }
}

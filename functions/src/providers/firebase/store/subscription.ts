import { providerLogger } from "@/common/utils/systemLogger";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

import { AlertMode } from "@/common/types";
import type {
  AlarmFilter,
  AlarmSubscription,
  AlarmSubscriptionInput,
  CityEn,
  RecruitSource,
} from "@/common/types";
import { FirebaseCollection } from "../constants/collections";

const SETTINGS_DOC_ID = "settings" as const;

/** 필드가 없거나 형식이 잘못된 소스 필터의 기본값 (기존 구독자는 모든 소스를 받음) */
const ALL_FILTER: AlarmFilter<never> = { mode: AlertMode.ALL };
/** 필드가 없거나 형식이 잘못된 지역 필터의 기본값 (알림 0건 쪽으로 안전하게) */
const EMPTY_SELECTED: AlarmFilter<never> = { mode: AlertMode.SELECTED, values: [] };

/**
 * 저장된 필터 필드 하나를 AlarmFilter로 읽는다.
 * 형식 오류는 던지지 않고 기본값으로 읽으며 경고 로그를 남긴다.
 */
function readFilter<T>(
  raw: unknown,
  fallback: AlarmFilter<T>,
  field: string,
  userId: string
): AlarmFilter<T> {
  if (raw === undefined) return fallback;
  const obj = raw as { mode?: unknown; values?: unknown } | null;
  if (obj?.mode === AlertMode.ALL) return { mode: AlertMode.ALL };
  if (obj?.mode === AlertMode.SELECTED && Array.isArray(obj.values)) {
    return { mode: AlertMode.SELECTED, values: obj.values as T[] };
  }
  providerLogger.warn("구독 필터 형식 오류 — 기본값으로 읽음", { userId, field });
  return fallback;
}

/**
 * 지역 필터를 읽는다. `regions`가 배열이면 옛 형식 `{alertMode, regions[]}`로 본다.
 */
function readRegions(
  data: FirebaseFirestore.DocumentData,
  userId: string
): AlarmFilter<CityEn> {
  if (Array.isArray(data.regions)) {
    return data.alertMode === AlertMode.ALL ?
      { mode: AlertMode.ALL } :
      { mode: AlertMode.SELECTED, values: data.regions as CityEn[] };
  }
  return readFilter<CityEn>(data.regions, EMPTY_SELECTED, "regions", userId);
}

/**
 * Firestore 문서 → AlarmSubscription 변환 헬퍼
 * Timestamp → number(ms) 변환과 옛 형식 읽기 변환을 store 경계 한 곳에서 수행
 */
function toAlarmSubscription(
  userId: string,
  data: FirebaseFirestore.DocumentData
): AlarmSubscription {
  return {
    userId,
    enabled: data.enabled,
    regions: readRegions(data, userId),
    sources: readFilter<RecruitSource>(data.sources, ALL_FILTER, "sources", userId),
    createdAt: (data.createdAt as Timestamp).toMillis(),
    updatedAt: (data.updatedAt as Timestamp).toMillis(),
  };
}

/**
 * 도메인 필터 → 저장용 객체. ALL이어도 `values`는 항상 배열로 넣는다
 * (모드만 SELECTED로 바꿨을 때 `values` 없는 문서가 생기지 않게 하고, `undefined` 쓰기를 막는다).
 */
function toStoredFilter<T>(f: AlarmFilter<T>): { mode: AlertMode; values: T[] } {
  return f.mode === AlertMode.ALL ?
    { mode: AlertMode.ALL, values: [] } :
    { mode: AlertMode.SELECTED, values: f.values };
}

/**
 * 사용자 알림 구독 설정 저장소
 *
 * Firestore 경로: `users/{userId}/notifications/settings`
 * 외부 코드는 항상 `number` ms 타임스탬프를 보고, Firestore Timestamp 변환은 본 클래스가 담당.
 */
export class SubscriptionStore {
  // 지연 평가: getFirestore()를 모듈 로드/생성 시점이 아니라 실제 접근 시점에 호출한다.
  // 싱글톤(alarmSubscriptionService)이 import 평가 중 생성되면서 initializeApp() 전에
  // getFirestore()를 부르던 app/no-app 로드 실패를 차단한다. getFirestore()는 default app의
  // Firestore를 메모이즈 반환하므로 매 접근 비용은 사실상 0.
  private get db() {
    return getFirestore();
  }

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

    // merge 없이 필드 전체를 교체한다 (중첩 객체가 필드 단위로 합쳐지는 것을 피함)
    const regions = toStoredFilter(input.regions);
    const sources = toStoredFilter(input.sources);
    if (snap.exists) {
      await ref.update({
        enabled: input.enabled,
        regions,
        sources,
        alertMode: FieldValue.delete(),
        updatedAt: now,
      });
    } else {
      await ref.set({
        enabled: input.enabled,
        regions,
        sources,
        createdAt: now,
        updatedAt: now,
      });
    }
    providerLogger.info("Notification settings saved", {
      userId,
      regionMode: input.regions.mode,
      sourceMode: input.sources.mode,
      enabled: input.enabled,
    });
  }

  /**
   * 지역 모드(ALL ↔ SELECTED)만 변경한다. 지역 목록은 남긴다.
   *
   * @remarks 문서 선존재 전제 — 없으면 `update()`가 NOT_FOUND를 throw.
   *   옛 형식(`regions`가 배열)이면 배열을 `values`로 옮겨 새 형식으로 교체한다.
   */
  async updateRegionMode(userId: string, mode: AlertMode): Promise<void> {
    const ref = this.getSettingsRef(userId);
    const regions = (await ref.get()).data()?.regions;
    const updatedAt = Timestamp.now();
    if (Array.isArray(regions)) {
      await ref.update({
        regions: { mode, values: regions },
        alertMode: FieldValue.delete(),
        updatedAt,
      });
      return;
    }
    await ref.update({ "regions.mode": mode, "alertMode": FieldValue.delete(), updatedAt });
  }

  /**
   * 지역 필터 전체 교체.
   *
   * @remarks 문서 선존재 전제 — `setNotificationSettings` 선행 필수. 없으면 NOT_FOUND throw.
   */
  async updateRegionFilter(userId: string, filter: AlarmFilter<CityEn>): Promise<void> {
    await this.getSettingsRef(userId).update({
      regions: toStoredFilter(filter),
      alertMode: FieldValue.delete(),
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * 소스 필터 전체 교체. `regions`는 건드리지 않으므로 `alertMode`도 지우지 않는다.
   *
   * @remarks 문서 선존재 전제 — `setNotificationSettings` 선행 필수. 없으면 NOT_FOUND throw.
   */
  async updateSourceFilter(userId: string, filter: AlarmFilter<RecruitSource>): Promise<void> {
    await this.getSettingsRef(userId).update({
      sources: toStoredFilter(filter),
      updatedAt: Timestamp.now(),
    });
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
      .filter((doc) => doc.id === SETTINGS_DOC_ID)
      .flatMap((doc) => {
        const userId = doc.ref.parent.parent!.id;
        try {
          return [toAlarmSubscription(userId, doc.data())];
        } catch (error) {
          // 문서 하나 때문에 그 회차 알림 전체가 멈추지 않게 한다
          providerLogger.warn("구독 문서를 읽지 못해 건너뜀", {
            userId,
            reason: (error as Error).message,
          });
          return [];
        }
      });
  }
}

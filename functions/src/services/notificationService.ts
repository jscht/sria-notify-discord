import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import type { Job, Recruit } from "@/common/types";
import {
  filterByRegion,
  filterBySource,
  filterVisibleSources,
  sortForNotification,
} from "@/common/utils/recruitFilter";
import { hashRecruits } from "@/common/utils/recruitHash";
import { eventBus, EventType } from "@/events/bus";
import type { NotificationSendEvent } from "@/events/bus";
import { RecruitStore } from "@/providers/firebase/store";
import { SubscriptionStore } from "@/providers/firebase/store/subscription";
import { getUserFacingSources, toDisplay } from "@/providers/recruit";
import { expandSourceFilter } from "@/providers/recruit/sourceToggle";
import { RedisManager } from "@/providers/redis/manager/redisManager";
import type { NotifiedHashStore } from "@/providers/redis/store";
import { RecruitCacheService } from "./recruitCacheService";
import { RecruitService } from "./recruitService";

/** 로컬 계속 실행의 알림 주기(분). 운영 일정은 `NOTIFICATION_SCHEDULE`을 따른다. */
export const NOTIFICATION_INTERVAL_MINUTES = 120;
/** 운영 알림 일정. 매일 06~20시 짝수 정시 (한국 시간). 22~04시 사이 바뀐 공고는 06시에 보낸다. */
export const NOTIFICATION_SCHEDULE = "0 6-20/2 * * *";

const NOTIFICATION_LOCK_KEY = "lock:notification";
/** 알림 락 만료 시간. 알림 실행 제한 시간(300초)과 같다. */
const NOTIFICATION_LOCK_TTL_MS = 5 * 60_000;

/** `NotificationService`가 쓰는 객체. 테스트는 가짜를 넘긴다. */
export interface NotificationDeps {
  redis: Pick<RedisManager, "acquireLock" | "releaseLock">;
  recruitService: RecruitService;
  recruitCache: RecruitCacheService;
  notifiedStore: NotifiedHashStore;
  recruitStore: RecruitStore;
  subscriptionStore: SubscriptionStore;
}

/**
 * 알림 스케줄러 서비스.
 *
 * 사이트를 갱신하고 지난 알림 때 목록과 비교한 뒤, 구독자별로 판정해
 * `NOTIFICATION_SEND`를 발행한다. 실제 DM 발송은 `NotificationSendHandler`가 맡는다.
 */
export class NotificationService {
  constructor(private readonly deps: NotificationDeps) {}

  /**
   * 구독자별로 공고를 거르고 `NOTIFICATION_SEND`를 발행한다.
   *
   * 구독 조건에 맞는 공고 중 바뀐 공고가 있는 구독자에게 맞는 공고 전체를 보낸다.
   * 구독자 한 명의 오류는 나머지 발송을 막지 않는다.
   *
   * @param current 최신 공고 목록
   * @param changedIds 지난 알림 뒤 바뀐 공고 ID
   * @returns 발송을 시도한 구독자 수. DM이 실패해도 센다
   * @throws 구독자 목록을 읽지 못했을 때 그대로 전달한다
   */
  async notifyRecruits(current: Job[], changedIds: ReadonlySet<string>): Promise<number> {
    if (changedIds.size === 0) return 0;

    // ① 숨긴 소스 제외, ② 접수중 → 발표중 → 종료 + 같은 상태 안 최신순 정렬 (모두 한 번만)
    const targetJobs = sortForNotification(
      filterVisibleSources(current, new Set(getUserFacingSources()))
    );
    if (targetJobs.length === 0) return 0;

    const subscribers = await this.deps.subscriptionStore.getAllActiveSubscribers();
    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        const bySource = filterBySource(targetJobs, expandSourceFilter(subscriber.sources)); // ③
        const matched = filterByRegion(bySource, subscriber.regions); // ④
        // 구독 조건에 맞는 공고 중 바뀐 것이 없으면 보내지 않는다
        if (!matched.some((job) => changedIds.has(job.id))) continue;

        const displays = matched.map((job) => toDisplay(job.value)); // ⑤ 바뀌지 않은 공고도 함께
        // 서버리스 실행이 DM 발송 완결까지 기다리도록 emitEventAndSettle 사용.
        await eventBus.emitEventAndSettle<NotificationSendEvent>(EventType.NOTIFICATION_SEND, {
          timestamp: Date.now(),
          source: "NotificationService",
          userId: subscriber.userId,
          displays,
          settings: subscriber,
        });
        sent++;
      } catch (error) {
        failed++;
        globalLogger.error("구독자 알림 처리 실패 — 다음 구독자로 진행", error as Error, {
          userId: subscriber.userId,
        });
      }
    }

    if (failed > 0) {
      globalLogger.warn(`알림 처리 실패 ${failed}/${subscribers.length}명`);
    }
    return sent;
  }

  /**
   * 알림 1회를 실행한다.
   *
   * 알림 락 → 공고 동기화 → 지난 알림 때 목록과 비교 → 발송 → 지난 알림 때 목록 저장 →
   * Firestore 공고 목록 저장 순서다. 저장은 발송이 끝난 뒤에 하므로, 발송 중 멈추면 다음 알림이
   * 다시 보낸다(누락보다 중복을 택한다).
   *
   * @returns 발송을 시도한 구독자 수. DM이 실패해도 센다. 건너뛰거나 저장만 했으면 0
   */
  async runNotification(): Promise<number> {
    const { redis } = this.deps;
    // 0. 알림 락: 같은 알림이 두 번 실행되면 뒤 실행은 바로 끝낸다
    const token = await redis.acquireLock(NOTIFICATION_LOCK_KEY, NOTIFICATION_LOCK_TTL_MS);
    if (!token) {
      globalLogger.warn("알림이 이미 실행 중 — 이번 실행은 건너뜀");
      return 0;
    }

    try {
      // 1. 사이트마다 동시에 강제 갱신
      const anySyncFailed = await this.deps.recruitService.syncAllSources();

      // 2. 최신 공고 목록 ↔ 지난 알림 때 목록 비교
      const current = (await this.deps.recruitCache.getRecruitList()) ?? [];
      if (current.length === 0 && anySyncFailed) {
        // 비교 기준과 Firestore 목록을 지키려고 아무것도 저장하지 않는다
        globalLogger.warn("공고 동기화 실패로 최신 공고 목록이 비어 있음 — 저장 없이 끝냄");
        return 0;
      }

      const currentHashes = hashRecruits(current);
      const notified = await this.deps.notifiedStore.getAll();
      if (!notified) {
        // 처음이거나 키를 지운 경우: 저장만 하고 보내지 않는다 (이미 받은 공고 재발송 방지)
        await this.deps.notifiedStore.clearAndSaveHashes(currentHashes);
        await this.backupToFirestore(current);
        globalLogger.warn("지난 알림 때 목록 없음 — 저장만 하고 발송하지 않음");
        return 0;
      }

      // 새 공고 + 내용이 바뀐 공고(마감으로 바뀐 공고 포함)
      const changedIds = new Set(
        current.filter((recruit) => notified[recruit.id] !== currentHashes[recruit.id])
          .map((recruit) => recruit.id)
      );

      // 3. 판정·발송
      const jobs = current.map((recruit): Job => ({ id: recruit.id, value: recruit }));
      const sent = await this.notifyRecruits(jobs, changedIds);

      // 4. 발송이 끝난 뒤 저장. 지금 목록에 없는 ID는 이때 빠진다
      await this.deps.notifiedStore.clearAndSaveHashes(currentHashes);

      // 5. Firestore 공고 목록 저장 (Redis가 비었을 때 공고 조회가 읽는 목록)
      await this.backupToFirestore(current);
      return sent;
    } finally {
      await redis.releaseLock(NOTIFICATION_LOCK_KEY, token);
    }
  }

  /** Firestore 공고 목록 저장. 실패해도 알림은 성공으로 끝낸다(다음 알림에서 다시 저장). */
  private async backupToFirestore(current: Recruit[]): Promise<void> {
    try {
      await this.deps.recruitStore.saveRecruitList(current);
    } catch (error) {
      globalLogger.error("Firestore 공고 목록 저장 실패 — 다음 알림에서 다시 저장", error as Error);
    }
  }
}

/** 운영 객체로 `NotificationDeps`를 채운다. Redis·Firebase 초기화 뒤에만 부른다. */
function createNotificationDeps(): NotificationDeps {
  const redis = RedisManager.getInstance();
  // eslint-disable-next-line camelcase -- store 레지스트리 속성명(Redis 서비스 키 관례)
  const { recruit, recruit_hash, notified } = redis.store;
  return {
    redis,
    recruitService: new RecruitService(),
    recruitCache: new RecruitCacheService(recruit, recruit_hash),
    notifiedStore: notified,
    recruitStore: new RecruitStore(),
    subscriptionStore: new SubscriptionStore(),
  };
}

let instance: NotificationService | undefined;

/**
 * 알림 서비스를 돌려준다. 처음 부를 때 만든다.
 *
 * 파일을 불러올 때 만들면 Redis 초기화 전에 `RedisManager.getInstance()`가 불려 예외가 난다.
 * Redis 초기화(`ready()`) 뒤에만 부른다.
 */
export function getNotificationService(): NotificationService {
  return (instance ??= new NotificationService(createNotificationDeps()));
}

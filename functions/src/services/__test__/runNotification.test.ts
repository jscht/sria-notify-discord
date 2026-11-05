import "dotenv/config";
/**
 * 알림 스케줄러 테스트 (design §6.1 #8, §2.8.2)
 *
 * 메모리 기반 가짜 저장소·락·구독자로 실제 `NotificationService`와 `RecruitService`를 실행한다.
 * 사이트 락 대기를 실제로 기다리므로 전체 실행에 약 20초 걸린다.
 */

import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { AlertMode } from "@/common/types";
import type {
  AlarmSubscription,
  Recruit,
  RecruitmentStatus,
  RecruitSource,
} from "@/common/types";
import { eventBus, EventType } from "@/events/bus";
import type { NotificationSendEvent } from "@/events/bus";
import { redisKeyManager } from "@/providers/redis/key";
import { NotifiedHashStore } from "@/providers/redis/store";
import {
  delay,
  expectEqual,
  expectRejects,
  expectTrue,
  reportResult,
  runCases,
} from "@/test/harness";
import type { TestCase } from "@/test/harness";
import {
  createMemoryCache,
  FakeRecruitSource,
  FakeRecruitStore,
  FakeSubscriptionStore,
  lastSyncKey,
  MemoryLockRedis,
  MemoryRedisClient,
  siteLockKey,
} from "@/test/mocks/memoryStores";
import { makeEliasRecruit, makeSriaRecruit } from "@/test/mocks/multiSource";
import { NotificationService } from "../notificationService";
import { RecruitService } from "../recruitService";

const NOTIFICATION_LOCK = "lock:notification";
const ALL_SOURCES: RecruitSource[] = ["sria", "elias"];
const LOCK_WAIT_MS = 10_000;
const HOLD_MS = 2_000;

const ELIAS_TITLE = "[요정 왕국] 기존 공고";
const SEOUL_TITLE = "[서울] 기존 공고";
const BUSAN_TITLE = "[부산] 기존 공고";

/** 발송 이벤트 수집. 구독자 한 명의 발송 핸들러가 오류를 내게 할 수도 있다. */
const capture: {
  sends: NotificationSendEvent[];
  failFor?: { userId: string; mode: "sync" | "async" };
} = { sends: [] };

function onNotificationSend(payload: NotificationSendEvent): void | Promise<void> {
  const failure = capture.failFor;
  if (failure && failure.userId === payload.userId) {
    if (failure.mode === "sync") throw new Error("발송 핸들러 동기 오류");
    return Promise.reject(new Error("발송 핸들러 비동기 오류"));
  }
  capture.sends.push(payload);
  return undefined;
}

function subscriber(
  userId: string,
  regions: AlarmSubscription["regions"] = { mode: AlertMode.ALL }
): AlarmSubscription {
  return {
    userId,
    enabled: true,
    regions,
    sources: { mode: AlertMode.ALL },
    createdAt: 0,
    updatedAt: 0,
  };
}

function baseSria(): Recruit[] {
  return [
    makeSriaRecruit(1, { title: SEOUL_TITLE, dayTxt: "2026.10.05 ~ 2026.10.20" }),
    makeSriaRecruit(2, { title: BUSAN_TITLE, dayTxt: "2026.10.06 ~ 2026.10.20" }),
  ];
}

/** elias 공고. sria 공고보다 시작 날짜가 늦어, 종료되면 정렬이 동작해야 맨 뒤로 간다. */
function baseElias(status: RecruitmentStatus = "접수중"): Recruit[] {
  return [
    makeEliasRecruit(1, {
      title: ELIAS_TITLE,
      period: "2026.10.07 14:00 ~ 2026.10.08 02:00",
      status,
    }),
  ];
}

function createEnv(subscribers: AlarmSubscription[] = [subscriber("user-all")]) {
  capture.sends.length = 0;
  capture.failFor = undefined;

  const locks = new MemoryLockRedis();
  const cache = createMemoryCache();
  const source = new FakeRecruitSource({ sria: baseSria(), elias: baseElias() });
  const firestore = new FakeRecruitStore();
  const notifiedClient = new MemoryRedisClient();
  const notifiedStore = new NotifiedHashStore(notifiedClient.asClient(), redisKeyManager.recruit);
  const subscriptions = new FakeSubscriptionStore(subscribers);
  const recruitService = new RecruitService({
    redis: locks,
    cacheService: cache.service,
    firestore: firestore.asStore(),
    recruitSource: source.asService(),
    lockWaitMs: LOCK_WAIT_MS,
  });
  const service = new NotificationService({
    redis: locks,
    recruitService,
    recruitCache: cache.service,
    notifiedStore,
    recruitStore: firestore.asStore(),
    subscriptionStore: subscriptions.asStore(),
  });

  /** 마지막 갱신 시각을 지우고 알림을 실행한다. 실행 뒤 알림 락이 풀렸는지도 확인한다. */
  const run = async (): Promise<number> => {
    ALL_SOURCES.forEach((recruitSource) => locks.deleteValue(lastSyncKey(recruitSource)));
    try {
      return await service.runNotification();
    } finally {
      expectTrue(!locks.isLocked(NOTIFICATION_LOCK), "실행 뒤 알림 락이 남아 있음");
    }
  };

  const clearLatest = (): void => {
    cache.cacheStore.clear();
    cache.hashStore.clear();
  };

  return {
    locks,
    cache,
    source,
    firestore,
    notifiedStore,
    subscriptions,
    service,
    run,
    clearLatest,
  };
}

type TestEnv = ReturnType<typeof createEnv>;

/** 첫 실행으로 지난 알림 때 목록을 저장한 환경을 만든다. */
async function createBaselineEnv(
  subscribers?: AlarmSubscription[],
  failSave = false
): Promise<TestEnv> {
  const env = createEnv(subscribers);
  await env.run();
  env.firestore.saveCalls.length = 0;
  env.firestore.failSave = failSave;
  env.source.resetFetchLog();
  return env;
}

function addSria(env: TestEnv, title: string): Recruit {
  const added = makeSriaRecruit(3, { title, dayTxt: "2026.10.08 ~ 2026.10.20" });
  env.source.lists.sria.push(added);
  return added;
}

function sentTitles(index = 0): string[] {
  return capture.sends[index].displays.map(({ title }) => title);
}

function sentUsers(): string[] {
  return capture.sends.map(({ userId }) => userId);
}

async function notifiedIds(env: TestEnv): Promise<string[]> {
  return Object.keys((await env.notifiedStore.getAll()) ?? {}).sort();
}

/** `saveRecruitList`가 최신 공고 목록으로 1번 불렸는지 확인한다. */
async function expectSavedOnce(env: TestEnv): Promise<void> {
  expectEqual(env.firestore.saveCalls.length, 1, "saveRecruitList 호출 횟수");
  expectEqual(env.firestore.saveCalls[0], (await env.cache.service.getRecruitList()) ?? []);
}

/** 같은 경우를 Firestore 저장이 정상일 때와 실패할 때로 나눠 실행한다. */
function withSaveFailure(
  name: string,
  scenario: (failSave: boolean) => Promise<void>
): TestCase[] {
  return [
    { name, run: () => scenario(false) },
    { name: `${name} (Firestore 저장 실패)`, run: () => scenario(true) },
  ];
}

/** 사이트 락을 미리 잡아 두고 `HOLD_MS` 뒤에 풀면서 알림을 실행한다. */
async function runWhileSiteLocked(
  env: TestEnv,
  source: RecruitSource,
  beforeRelease: () => Promise<void> = async () => {}
): Promise<{ sent: number; releasedAt: number }> {
  const lockKey = siteLockKey(source);
  const token = env.locks.hold(lockKey);
  let releasedAt = 0;
  const release = delay(HOLD_MS).then(async () => {
    await beforeRelease();
    releasedAt = Date.now();
    await env.locks.releaseLock(lockKey, token);
  });
  const [sent] = await Promise.all([env.run(), release]);
  return { sent, releasedAt };
}

const saveCases: TestCase[] = [
  ...withSaveFailure("① 지난 알림 때 목록 없이 실행: 발송 0건, 목록 저장", async (failSave) => {
    const env = createEnv();
    env.firestore.failSave = failSave;

    const sent = await env.run();

    expectEqual(sent, 0);
    expectEqual(capture.sends.length, 0);
    expectEqual(await notifiedIds(env), ["elias:1", "sria:1", "sria:2"]);
    await expectSavedOnce(env);
  }),
  ...withSaveFailure("② 공고 1건 추가: 추가 공고와 기존 공고가 함께 발송", async (failSave) => {
    const env = await createBaselineEnv(undefined, failSave);
    const added = addSria(env, "[서울] 추가 공고");

    const sent = await env.run();

    expectEqual(sent, 1);
    expectEqual(sentUsers(), ["user-all"]);
    const expectedTitles = [added.title, ELIAS_TITLE, BUSAN_TITLE, SEOUL_TITLE];
    expectEqual([...sentTitles()].sort(), expectedTitles.sort());
    expectTrue((await notifiedIds(env)).includes(added.id), "추가 공고가 목록에 저장되지 않음");
    await expectSavedOnce(env);
  }),
  ...withSaveFailure("⑦ 공고가 종료로 바뀜: 발송되고 종료 공고가 맨 뒤", async (failSave) => {
    const env = await createBaselineEnv(undefined, failSave);
    env.source.lists.elias.splice(0, 1, ...baseElias("종료"));

    const sent = await env.run();

    expectEqual(sent, 1);
    const { displays } = capture.sends[0];
    expectEqual(displays[displays.length - 1].title, ELIAS_TITLE);
    expectEqual(displays[displays.length - 1].status, "종료");
    await expectSavedOnce(env);
  }),
  ...withSaveFailure("⑧ 부산 공고만 추가: 부산 구독자만 발송", async (failSave) => {
    const env = await createBaselineEnv([
      subscriber("user-seoul", { mode: AlertMode.SELECTED, values: ["seoul"] }),
      subscriber("user-busan", { mode: AlertMode.SELECTED, values: ["busan"] }),
    ], failSave);
    addSria(env, "[부산] 추가 공고");

    const sent = await env.run();

    expectEqual(sent, 1);
    expectEqual(sentUsers(), ["user-busan"]);
    await expectSavedOnce(env);
  }),
  ...withSaveFailure("⑨ 구독자 1명의 핸들러 오류: 다른 1명은 발송, 목록 저장", async (failSave) => {
    const env = await createBaselineEnv(
      [subscriber("user-bad"), subscriber("user-good")],
      failSave
    );
    capture.failFor = { userId: "user-bad", mode: "sync" };
    const added = addSria(env, "[서울] 추가 공고");

    const sent = await env.run();

    expectEqual(sent, 1);
    expectEqual(sentUsers(), ["user-good"]);
    expectTrue((await notifiedIds(env)).includes(added.id), "지난 알림 때 목록이 저장되지 않음");
    await expectSavedOnce(env);
  }),
];

const flowCases: TestCase[] = [
  {
    name: "③ 알림 락을 미리 잡아 둠: 발송 0건, 건너뜀",
    run: async () => {
      const env = createEnv();
      env.locks.hold(NOTIFICATION_LOCK);

      const sent = await env.service.runNotification();

      expectEqual(sent, 0);
      expectEqual(capture.sends.length, 0);
      expectEqual(env.source.fetchCount("sria"), 0);
      expectEqual(await env.notifiedStore.getAll(), null);
    },
  },
  {
    name: "④ 구독자 목록 읽기 실패: 목록이 저장되지 않아 다음 실행에서 다시 발송",
    run: async () => {
      const env = await createBaselineEnv();
      const before = await env.notifiedStore.getAll();
      const added = addSria(env, "[서울] 추가 공고");
      env.subscriptions.failNextRead = true;

      await expectRejects(env.run());

      expectEqual(await env.notifiedStore.getAll(), before);
      expectEqual(capture.sends.length, 0);
      expectEqual(env.firestore.saveCalls.length, 0);

      const sent = await env.run();

      expectEqual(sent, 1);
      expectTrue(sentTitles().includes(added.title), "다시 실행에서 추가 공고가 빠짐");
    },
  },
  {
    name: "⑤ 앞 갱신이 성공하고 사이트 락이 풀림: 그 사이트를 다시 가져오지 않음",
    run: async () => {
      const env = await createBaselineEnv();

      const { sent } = await runWhileSiteLocked(env, "elias", () => (
        env.locks.setValue(lastSyncKey("elias"), String(Date.now()), 60_000)
      ));

      expectEqual(env.source.fetchCount("elias"), 0);
      expectEqual(env.source.fetchCount("sria"), 1);
      expectEqual(sent, 0);
    },
  },
  {
    name: "⑥ 앞 갱신이 실패하고 사이트 락만 풀림: 그 사이트를 1번 가져옴",
    run: async () => {
      const env = await createBaselineEnv();

      const { sent } = await runWhileSiteLocked(env, "elias");

      expectEqual(env.source.fetchCount("elias"), 1);
      expectEqual(sent, 0);
    },
  },
  {
    name: "⑨ 핸들러가 비동기로 실패해도 다른 구독자는 발송, 목록 저장",
    run: async () => {
      const env = await createBaselineEnv([subscriber("user-bad"), subscriber("user-good")]);
      capture.failFor = { userId: "user-bad", mode: "async" };
      const added = addSria(env, "[서울] 추가 공고");

      const sent = await env.run();

      expectEqual(sent, 2); // 발송 시도 인원. 비동기 실패도 센다
      expectEqual(sentUsers(), ["user-good"]);
      expectTrue((await notifiedIds(env)).includes(added.id), "지난 알림 때 목록이 저장되지 않음");
    },
  },
  {
    name: "⑩ 최신 목록이 비고 모든 사이트 실패: 두 목록이 그대로",
    run: async () => {
      const env = await createBaselineEnv();
      const notifiedBefore = await env.notifiedStore.getAll();
      const firestoreBefore = env.firestore.list;
      env.clearLatest();
      ALL_SOURCES.forEach((source) => env.source.failing.add(source));

      const sent = await env.run();

      expectEqual(sent, 0);
      expectEqual(capture.sends.length, 0);
      expectEqual(await env.notifiedStore.getAll(), notifiedBefore);
      expectEqual(env.firestore.saveCalls.length, 0);
      expectEqual(env.firestore.list, firestoreBefore);
    },
  },
  {
    name: "⑪ 모든 사이트가 정상 0건: 두 목록을 비우고 다음 실행은 첫 실행이 아님",
    run: async () => {
      const env = await createBaselineEnv();
      env.source.lists.sria.length = 0;
      env.source.lists.elias.length = 0;

      const firstSent = await env.run();

      expectEqual(firstSent, 0);
      expectEqual(await env.notifiedStore.getAll(), {});
      expectEqual(env.firestore.saveCalls, [[]]);
      expectEqual(env.firestore.list, []);

      const added = addSria(env, "[서울] 추가 공고");
      const nextSent = await env.run();

      expectEqual(nextSent, 1);
      expectEqual(sentTitles(), [added.title]);
    },
  },
  {
    name: "⑫ 한 사이트만 실패: 추가 공고가 발송",
    run: async () => {
      const env = await createBaselineEnv();
      env.source.failing.add("elias");
      const added = addSria(env, "[서울] 추가 공고");

      const sent = await env.run();

      expectEqual(sent, 1);
      expectTrue(sentTitles().includes(added.title), "추가 공고가 빠짐");
    },
  },
  {
    name: "⑬ 사이트 락 대기 중에도 다른 사이트는 바로 시작",
    run: async () => {
      const env = await createBaselineEnv();
      const startedAt = Date.now();

      const { sent, releasedAt } = await runWhileSiteLocked(env, "elias");

      const sriaDelay = env.source.firstFetchAt("sria") - startedAt;
      expectTrue(sriaDelay < 1_000, `sria가 ${sriaDelay}ms 기다림`);
      expectTrue(env.source.firstFetchAt("elias") >= releasedAt, "elias가 락을 기다리지 않음");
      expectEqual(sent, 0);
    },
  },
  {
    name: "⑭ 최신 목록이 비고 모든 사이트 락 대기 초과: 두 목록이 그대로",
    run: async () => {
      const env = await createBaselineEnv();
      const notifiedBefore = await env.notifiedStore.getAll();
      const firestoreBefore = env.firestore.list;
      env.clearLatest();
      ALL_SOURCES.forEach((source) => env.locks.hold(siteLockKey(source)));

      const sent = await env.run();

      expectEqual(sent, 0);
      expectEqual(capture.sends.length, 0);
      expectEqual(env.source.fetchCount("sria"), 0);
      expectEqual(env.source.fetchCount("elias"), 0);
      expectEqual(await env.notifiedStore.getAll(), notifiedBefore);
      expectEqual(env.firestore.saveCalls.length, 0);
      expectEqual(env.firestore.list, firestoreBefore);
    },
  },
];

export async function testRunNotification(): Promise<boolean> {
  eventBus.onEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, onNotificationSend);
  try {
    return await runCases("알림 스케줄러", [...saveCases, ...flowCases]);
  } finally {
    eventBus.offEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, onNotificationSend);
  }
}

if (require.main === module) {
  reportResult(testRunNotification());
}

import "dotenv/config";
/**
 * 공고 조회의 읽기 경로 테스트 (design §6.1 #10, §2.8.4)
 *
 * 경우마다 새 저장소로 시작한다. ③은 사이트 락 대기를 실제로 기다려 약 3초 걸린다.
 */

import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import type { Recruit, RecruitSource } from "@/common/types";
import { delay, expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";
import {
  createMemoryCache,
  FakeRecruitSource,
  FakeRecruitStore,
  lastSyncKey,
  MemoryLockRedis,
  siteLockKey,
} from "@/test/mocks/memoryStores";
import { makeEliasRecruit, makeSriaRecruit } from "@/test/mocks/multiSource";
import { RecruitService } from "../recruitService";

const ALL_SOURCES: RecruitSource[] = ["sria", "elias"];
const SRIA_LIST: Recruit[] = [makeSriaRecruit(1), makeSriaRecruit(2, { title: "[부산] sria 공고" })];
const ELIAS_LIST: Recruit[] = [makeEliasRecruit(1, { title: "[요정 왕국] elias 공고" })];
const ALL_IDS = ["elias:1", "sria:1", "sria:2"];

function createEnv() {
  const locks = new MemoryLockRedis();
  const cache = createMemoryCache();
  const source = new FakeRecruitSource({ sria: [...SRIA_LIST], elias: [...ELIAS_LIST] });
  const firestore = new FakeRecruitStore();
  const service = new RecruitService({
    redis: locks,
    cacheService: cache.service,
    firestore: firestore.asStore(),
    recruitSource: source.asService(),
    lockWaitMs: 10_000,
  });
  return { locks, cache, source, firestore, service };
}

function ids(list: Recruit[] | null): string[] {
  return (list ?? []).map(({ id }) => id).sort();
}

export async function testGetRecruitList(): Promise<boolean> {
  return runCases("공고 조회의 읽기 경로", [
    {
      name: "① Redis에 목록이 있음: redis, 사이트 가져오기 0회",
      run: async () => {
        const env = createEnv();
        await env.cache.cacheStore.save(SRIA_LIST[0].id, SRIA_LIST[0], 60);

        const { data, tier } = await env.service.getRecruitList();

        expectEqual(tier, "redis");
        expectEqual(ids(data), [SRIA_LIST[0].id]);
        expectEqual(env.source.fetchCount("sria"), 0);
        expectEqual(env.source.fetchCount("elias"), 0);
        expectEqual(env.firestore.saveCalls.length, 0);
      },
    },
    {
      name: "② Redis가 빔: source, 사이트마다 1회, 사이트별 저장과 마지막 갱신 시각",
      run: async () => {
        const env = createEnv();

        const { data, tier } = await env.service.getRecruitList();

        expectEqual(tier, "source");
        expectEqual(ids(data), ALL_IDS);
        for (const source of ALL_SOURCES) {
          expectEqual(env.source.fetchCount(source), 1);
          expectTrue(
            (await env.locks.getValue(lastSyncKey(source))) !== null,
            `${source} 마지막 갱신 시각이 없음`
          );
        }
        expectEqual(Array.from(env.cache.hashStore.hashes.keys()).sort(), ALL_IDS);
        expectEqual(env.firestore.saveCalls.length, 0);
      },
    },
    {
      name: "③ elias 사이트 락이 잡혀 있음: 풀린 뒤 결과를 씀",
      run: async () => {
        const env = createEnv();
        const lockKey = siteLockKey("elias");
        const token = env.locks.hold(lockKey);
        let releasedAt = 0;
        const release = delay(2_000).then(async () => {
          releasedAt = Date.now();
          await env.locks.releaseLock(lockKey, token);
        });

        const [{ data, tier }] = await Promise.all([env.service.getRecruitList(), release]);

        expectEqual(tier, "source");
        expectEqual(ids(data), ALL_IDS);
        expectTrue(env.source.firstFetchAt("elias") >= releasedAt, "elias가 락을 기다리지 않음");
        expectEqual(env.source.fetchCount("elias"), 1);
        expectEqual(env.firestore.saveCalls.length, 0);
      },
    },
    {
      name: "④ 가져오기가 모두 실패하고 Firestore에 목록이 있음: firestore, Redis에 쓰지 않음",
      run: async () => {
        const env = createEnv();
        ALL_SOURCES.forEach((source) => env.source.failing.add(source));
        env.firestore.list = SRIA_LIST;

        const { data, tier } = await env.service.getRecruitList();

        expectEqual(tier, "firestore");
        expectEqual(data, SRIA_LIST);
        expectEqual(env.cache.cacheStore.items.size, 0);
        expectEqual(env.cache.hashStore.hashes.size, 0);
        expectEqual(env.firestore.saveCalls.length, 0);
      },
    },
    {
      name: "⑤ Firestore도 빔: empty",
      run: async () => {
        const env = createEnv();
        ALL_SOURCES.forEach((source) => env.source.failing.add(source));

        const { data, tier } = await env.service.getRecruitList();

        expectEqual(tier, "empty");
        expectEqual(data, null);
        expectEqual(env.firestore.saveCalls.length, 0);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testGetRecruitList());
}

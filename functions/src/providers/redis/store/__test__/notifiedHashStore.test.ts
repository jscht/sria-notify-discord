/**
 * 지난 알림 때 목록 저장 테스트 (design §6.1 #11, §2.8.2)
 *
 * 메모리 기반 가짜 Redis 클라이언트로 실제 저장소 코드를 실행한다.
 */

import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { expectEqual, expectRejects, reportResult, runCases } from "@/test/harness";
import { MemoryRedisClient } from "@/test/mocks/memoryStores";
import { RecruitKeyManager } from "../../key/recruitKeyManager";
import { NotifiedHashStore } from "../notifiedHashStore";

function createStore() {
  const keyManager = new RecruitKeyManager();
  const client = new MemoryRedisClient();
  const store = new NotifiedHashStore(client.asClient(), keyManager);
  return { client, key: keyManager.getKeys().notified, store };
}

export async function testNotifiedHashStore(): Promise<boolean> {
  return runCases("지난 알림 때 목록 저장", [
    {
      name: "① 키 없이 getAll: null",
      run: async () => {
        const { store } = createStore();
        expectEqual(await store.getAll(), null);
      },
    },
    {
      name: "② 빈 객체로 저장 후 getAll: 빈 객체 (표시 항목이 보이지 않음)",
      run: async () => {
        const { client, key, store } = createStore();

        await store.clearAndSaveHashes({});

        expectEqual(await store.getAll(), {});
        const stored = await client.hGetAll(key);
        expectEqual(Object.keys(stored).length, 1, "키가 남아 있어야 함");
      },
    },
    {
      name: "③ 공고 2건 저장 후 1건으로 저장: 1건만 남음",
      run: async () => {
        const { store } = createStore();

        await store.clearAndSaveHashes({ "sria:1": "hash-1", "sria:2": "hash-2" });
        await store.clearAndSaveHashes({ "sria:2": "hash-2" });

        expectEqual(await store.getAll(), { "sria:2": "hash-2" });
      },
    },
    {
      name: "빈 목록 뒤 공고를 저장하면 표시 항목이 남지 않음",
      run: async () => {
        const { client, key, store } = createStore();

        await store.clearAndSaveHashes({});
        await store.clearAndSaveHashes({ "sria:1": "hash-1" });

        expectEqual(await client.hGetAll(key), { "sria:1": "hash-1" });
      },
    },
    {
      name: "④ multi 안의 저장 실패: 기존 값이 그대로 남음",
      run: async () => {
        const { client, store } = createStore();
        await store.clearAndSaveHashes({ "sria:1": "hash-1", "sria:2": "hash-2" });
        client.failNextExec = true;

        await expectRejects(store.clearAndSaveHashes({ "sria:3": "hash-3" }));

        expectEqual(await store.getAll(), { "sria:1": "hash-1", "sria:2": "hash-2" });
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testNotifiedHashStore());
}

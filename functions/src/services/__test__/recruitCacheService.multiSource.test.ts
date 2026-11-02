import "dotenv/config";
/**
 * 소스별 변경 감지 분리 테스트 (design §6.1 #1)
 *
 * elias 공고가 바뀌어도 sria 회차의 비교 결과에 섞이지 않는지 확인한다.
 */

import type { EliasRecruit, Recruit } from "@/common/types";
import { expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";
import { createMemoryCache } from "@/test/mocks/memoryStores";
import { makeEliasRecruits, makeSriaRecruit } from "@/test/mocks/multiSource";
import { CacheUpdateStatus } from "../recruitCacheService";

const SRIA_LIST: Recruit[] = [
  makeSriaRecruit(1, { title: "[서울] sria 공고" }),
  makeSriaRecruit(2, { title: "[부산] sria 공고" }),
];

function closeFirstOpen(list: EliasRecruit[]): { closedId: string; next: EliasRecruit[] } {
  const target = list.find((recruit) => recruit.status === "접수중");
  if (!target) throw new Error("접수중 elias 공고가 없음");
  return {
    closedId: target.id,
    next: list.map((recruit): EliasRecruit => (
      recruit.id === target.id ? { ...recruit, status: "종료" } : recruit
    )),
  };
}

export async function testMultiSourceDiff(): Promise<boolean> {
  return runCases("소스별 변경 감지", [
    {
      name: "기준선 저장 뒤 elias는 바뀐 1건만, sria는 UNCHANGED",
      run: async () => {
        const { hashStore, service } = createMemoryCache();
        const eliasList = makeEliasRecruits();
        const { closedId, next } = closeFirstOpen(eliasList);

        const sriaBase = await service.setRecruitList(SRIA_LIST, "sria");
        const eliasBase = await service.setRecruitList(eliasList, "elias");
        expectEqual(sriaBase.status, CacheUpdateStatus.NO_DATA);
        expectEqual(eliasBase.status, CacheUpdateStatus.NO_DATA, "elias 기준선이 sria에 섞임");

        const eliasRun = await service.setRecruitList(next, "elias");
        expectEqual(eliasRun.status, CacheUpdateStatus.CHANGED);
        expectEqual(eliasRun.diff.updatedJobs.map((job) => job.id), [closedId]);
        expectEqual(eliasRun.diff.addedJobs, []);
        expectEqual(eliasRun.diff.deletedIds, []);

        const sriaRun = await service.setRecruitList(SRIA_LIST, "sria");
        expectEqual(sriaRun.status, CacheUpdateStatus.UNCHANGED);
        expectEqual(sriaRun.diff.addedJobs, []);
        expectEqual(sriaRun.diff.updatedJobs, []);
        expectEqual(sriaRun.diff.deletedIds, [], "deletedIds에 elias id가 들어옴");

        // 두 사이트 공고가 저장소에 함께 남아 있어야 한다
        expectEqual(hashStore.hashes.size, SRIA_LIST.length + eliasList.length);
      },
    },
    {
      name: "sria 공고를 지워도 deletedIds에 sria id만 잡힘",
      run: async () => {
        const { service } = createMemoryCache();
        const eliasList = makeEliasRecruits();
        await service.setRecruitList(SRIA_LIST, "sria");
        await service.setRecruitList(eliasList, "elias");

        const { diff } = await service.setRecruitList(SRIA_LIST.slice(0, 1), "sria");
        expectEqual(diff.deletedIds, [SRIA_LIST[1].id]);
        expectTrue(diff.deletedIds.every((id) => id.startsWith("sria:")), "elias id가 삭제됨");
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testMultiSourceDiff());
}

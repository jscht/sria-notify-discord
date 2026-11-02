import "dotenv/config";
/**
 * 노출 여부 테스트 (design §6.1 #4)
 *
 * 숨긴 소스는 소스 ALL 구독자에게도 가지 않아야 한다.
 */

import { AlertMode } from "@/common/types";
import type { AlarmFilter, Job, RecruitSource } from "@/common/types";
import { filterBySource, filterVisibleSources } from "@/common/utils/recruitFilter";
import { getUserFacingSources } from "@/providers/recruit";
import { expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";
import { makeEliasJob, makeSriaJob } from "@/test/mocks/multiSource";

const JOBS: Job[] = [makeSriaJob(1), makeSriaJob(2), makeEliasJob(1), makeEliasJob(2)];

function countElias(jobs: Job[]): number {
  return jobs.filter((job) => job.value.source === "elias").length;
}

export async function testUserFacing(): Promise<boolean> {
  return runCases("노출 여부", [
    {
      name: "getUserFacingSources에 sria·elias가 모두 있음",
      run: () => {
        const sources = getUserFacingSources();
        expectTrue(sources.includes("sria"), "sria가 없음");
        expectTrue(sources.includes("elias"), "elias가 없음");
      },
    },
    {
      name: "숨긴 소스는 소스 ALL 구독자에게 가지 않음",
      run: () => {
        const visible = filterVisibleSources(JOBS, new Set<RecruitSource>(["sria"]));
        const allSources: AlarmFilter<RecruitSource> = { mode: AlertMode.ALL };

        const matched = filterBySource(visible, allSources);
        expectEqual(countElias(matched), 0);
        expectEqual(matched.length, 2);
      },
    },
    {
      name: "숨긴 소스를 고른 구독자에게도 가지 않음",
      run: () => {
        const visible = filterVisibleSources(JOBS, new Set<RecruitSource>(["sria"]));
        const selected: AlarmFilter<RecruitSource> = {
          mode: AlertMode.SELECTED,
          values: ["elias"],
        };

        expectEqual(filterBySource(visible, selected), []);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testUserFacing());
}

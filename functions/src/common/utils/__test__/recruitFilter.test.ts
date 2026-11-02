import "dotenv/config";
/**
 * 구독 조건 일치와 상태 읽기 테스트 (design §6.1 #3)
 */

import { AlertMode } from "@/common/types";
import type { AlarmFilter, CityEn, Job, RecruitSource } from "@/common/types";
import { expectEqual, reportResult, runCases } from "@/test/harness";
import {
  makeEliasJob,
  makeEliasRecruit,
  makeSriaJob,
  makeSriaRecruit,
} from "@/test/mocks/multiSource";
import { filterByRegion, filterBySource, getRecruitStatus } from "../recruitFilter";

const SRIA_SEOUL = makeSriaJob(1, { title: "[서울] sria 공고" });
const SRIA_BUSAN = makeSriaJob(2, { title: "[부산] sria 공고" });
const ELIAS_FAIRY = makeEliasJob(1, { title: "[요정 왕국] elias 공고" });
const ELIAS_TREE = makeEliasJob(2, { title: "[세계수 교단] elias 공고" });
const JOBS: Job[] = [SRIA_SEOUL, SRIA_BUSAN, ELIAS_FAIRY, ELIAS_TREE];

const ALL_SOURCES: AlarmFilter<RecruitSource> = { mode: AlertMode.ALL };
const ALL_REGIONS: AlarmFilter<CityEn> = { mode: AlertMode.ALL };

function selectedSources(...values: RecruitSource[]): AlarmFilter<RecruitSource> {
  return { mode: AlertMode.SELECTED, values };
}

function selectedRegions(...values: CityEn[]): AlarmFilter<CityEn> {
  return { mode: AlertMode.SELECTED, values };
}

function ids(jobs: Job[]): string[] {
  return jobs.map((job) => job.id);
}

export async function testRecruitFilter(): Promise<boolean> {
  return runCases("구독 조건 일치", [
    {
      name: "소스 필터: sria만",
      run: () => {
        expectEqual(ids(filterBySource(JOBS, selectedSources("sria"))), ids([SRIA_SEOUL, SRIA_BUSAN]));
      },
    },
    {
      name: "소스 필터: elias만",
      run: () => {
        expectEqual(ids(filterBySource(JOBS, selectedSources("elias"))), ids([ELIAS_FAIRY, ELIAS_TREE]));
      },
    },
    {
      name: "소스 필터: 둘 다 고름",
      run: () => {
        expectEqual(ids(filterBySource(JOBS, selectedSources("sria", "elias"))), ids(JOBS));
      },
    },
    {
      name: "소스 필터: ALL",
      run: () => {
        expectEqual(ids(filterBySource(JOBS, ALL_SOURCES)), ids(JOBS));
      },
    },
    {
      name: "지역 필터: SELECTED + 0개는 0건",
      run: () => {
        expectEqual(filterByRegion(JOBS, selectedRegions()), []);
      },
    },
    {
      name: "지역 필터: ALL은 소스 결과 그대로",
      run: () => {
        const bySource = filterBySource(JOBS, selectedSources("elias"));
        expectEqual(ids(filterByRegion(bySource, ALL_REGIONS)), ids(bySource));
      },
    },
    {
      name: "소스 → 지역: 고른 소스의 고른 지역만 남음",
      run: () => {
        const sriaOnly = filterBySource(JOBS, selectedSources("sria"));
        const eliasOnly = filterBySource(JOBS, selectedSources("elias"));

        expectEqual(ids(filterByRegion(sriaOnly, selectedRegions("busan"))), ids([SRIA_BUSAN]));
        expectEqual(filterByRegion(eliasOnly, selectedRegions("seoul")), []);
        expectEqual(
          ids(filterByRegion(eliasOnly, selectedRegions("fairyKingdom"))),
          ids([ELIAS_FAIRY])
        );
      },
    },
    {
      name: "상태 읽기: 소스 필드 값 그대로",
      run: () => {
        expectEqual(getRecruitStatus(makeSriaRecruit(1, { recruitmentStatus: "접수중" })), "접수중");
        expectEqual(getRecruitStatus(makeSriaRecruit(2, { recruitmentStatus: "발표중" })), "발표중");
        expectEqual(getRecruitStatus(makeSriaRecruit(3, { recruitmentStatus: "종료" })), "종료");
        expectEqual(getRecruitStatus(makeEliasRecruit(1, { status: "접수중" })), "접수중");
        expectEqual(getRecruitStatus(makeEliasRecruit(2, { status: "종료" })), "종료");
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testRecruitFilter());
}

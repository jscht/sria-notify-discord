import "dotenv/config";
/**
 * 정렬 테스트 (design §6.1 #7, §2.7)
 */

import type { Job } from "@/common/types";
import { expectEqual, reportResult, runCases } from "@/test/harness";
import { makeEliasJob, makeSriaJob } from "@/test/mocks/multiSource";
import { getStartDate, sortByStartDateDesc, sortForNotification } from "../recruitFilter";

const ELIAS_END = "2026.10.20 02:00";

const OLD_SRIA = makeSriaJob(1, { dayTxt: "2026.10.09 ~ 2026.10.20" });
const NEW_ELIAS = makeEliasJob(1, { period: `2026.10.12 14:00 ~ ${ELIAS_END}` });
const SAME_DAY_SRIA = makeSriaJob(2, { dayTxt: "2026.10.12 ~ 2026.10.20" });
const MALFORMED = makeSriaJob(3, { dayTxt: "기간 미정" });
const EARLY_ELIAS = makeEliasJob(2, { period: `2026.10.10 01:00 ~ ${ELIAS_END}` });
const LATE_ELIAS = makeEliasJob(3, { period: `2026.10.10 23:30 ~ ${ELIAS_END}` });

function sortIds(jobs: Job[]): string[] {
  return sortByStartDateDesc(jobs, (job) => job.value).map((job) => job.id);
}

function ids(jobs: Job[]): string[] {
  return jobs.map((job) => job.id);
}

export async function testRecruitSort(): Promise<boolean> {
  return runCases("공고 정렬", [
    {
      name: "시작 시점 최신순, 형식 오류는 맨 뒤",
      run: () => {
        const input = [OLD_SRIA, MALFORMED, NEW_ELIAS, SAME_DAY_SRIA, EARLY_ELIAS, LATE_ELIAS];
        const expected = [NEW_ELIAS, SAME_DAY_SRIA, LATE_ELIAS, EARLY_ELIAS, OLD_SRIA, MALFORMED];

        expectEqual(sortIds(input), ids(expected));
      },
    },
    {
      name: "같은 날이면 시각이 늦은 공고가 앞, 같은 시각은 넣은 순서",
      run: () => {
        expectEqual(sortIds([EARLY_ELIAS, LATE_ELIAS]), ids([LATE_ELIAS, EARLY_ELIAS]));
        const sameTime = makeEliasJob(4, { period: `2026.10.10 23:30 ~ ${ELIAS_END}` });
        expectEqual(sortIds([LATE_ELIAS, sameTime]), ids([LATE_ELIAS, sameTime]));
        expectEqual(sortIds([sameTime, LATE_ELIAS]), ids([sameTime, LATE_ELIAS]));
      },
    },
    {
      name: "시작 시점 읽기: 소스별 필드에서 읽고 형식 오류는 빈 값",
      run: () => {
        expectEqual(getStartDate(OLD_SRIA.value), "2026.10.09");
        expectEqual(getStartDate(NEW_ELIAS.value), "2026.10.12 14:00");
        expectEqual(getStartDate(MALFORMED.value), "");
      },
    },
    {
      name: "원본 목록을 바꾸지 않음",
      run: () => {
        const input = [OLD_SRIA, NEW_ELIAS];
        sortByStartDateDesc(input, (job) => job.value);
        expectEqual(ids(input), ids([OLD_SRIA, NEW_ELIAS]));
      },
    },
    {
      name: "알림 정렬: 상태 순서 뒤 같은 상태 안 최신순",
      run: () => {
        const a = makeSriaJob(11, { dayTxt: "2026.10.11 ~ 2026.10.20" });
        const b = makeEliasJob(12, { period: `2026.10.12 10:00 ~ ${ELIAS_END}`, status: "종료" });
        const c = makeEliasJob(13, { period: `2026.10.09 10:00 ~ ${ELIAS_END}` });
        const d = makeSriaJob(14, {
          dayTxt: "2026.10.10 ~ 2026.10.20",
          recruitmentStatus: "발표중",
        });

        expectEqual(ids(sortForNotification([b, d, c, a])), ids([a, c, d, b]));
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testRecruitSort());
}

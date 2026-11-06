import "dotenv/config";
/**
 * elias 생성 규칙 테스트 (design §6.1 #6, §2.6)
 *
 * 고정 시작 시각부터 30분 간격으로 31일 동안 생성 결과를 모아 규칙을 확인한다.
 */

import type { EliasRecruit } from "@/common/types";
import {
  expectEqual,
  expectTrue,
  reportResult,
  runCases,
  withMutedLogs,
} from "@/test/harness";
import { createMemoryCache } from "@/test/mocks/memoryStores";
import { eliasConfig } from "../elias/eliasMockConfig";
import { generateEliasRecruits } from "../elias/eliasRule";

const { unitMs, lifespanTicks } = eliasConfig;
const DAYS = 31;
const TICKS_PER_DAY = (24 * 60 * 60_000) / unitMs;
const TOTAL_TICKS = DAYS * TICKS_PER_DAY;
const START_TICK = Math.floor(Date.UTC(2026, 9, 1) / unitMs);
const KST_OFFSET_MS = 9 * 60 * 60_000;

const ELIAS_REGIONS = ["요정 왕국", "세계수 교단"];
const PERIOD_PATTERN = /^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2} ~ \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/;

interface Snapshot {
  tick: number;
  list: EliasRecruit[];
}

function collectSnapshots(): Snapshot[] {
  const snapshots: Snapshot[] = [];
  for (let i = 0; i < TOTAL_TICKS; i++) {
    const tick = START_TICK + i;
    snapshots.push({ tick, list: generateEliasRecruits(tick * unitMs, eliasConfig) });
  }
  return snapshots;
}

/** 공고 ID별로 회차 순서대로 값을 모은다. */
function groupById(snapshots: Snapshot[]): Map<string, EliasRecruit[]> {
  const history = new Map<string, EliasRecruit[]>();
  for (const { list } of snapshots) {
    for (const recruit of list) {
      history.set(recruit.id, [...(history.get(recruit.id) ?? []), recruit]);
    }
  }
  return history;
}

/** 공고 ID `elias:{회차}-{순번}`에서 회차를 읽는다. */
function spawnTick(id: string): number {
  const match = /^elias:(\d+)-\d+$/.exec(id);
  if (!match) throw new Error(`공고 ID 형식 오류: ${id}`);
  return Number(match[1]);
}

/** epoch ms → `YYYY.MM.DD HH:mm` (한국 시간). 구현과 다른 방법으로 계산해 비교한다. */
function toKst(ms: number): string {
  const iso = new Date(ms + KST_OFFSET_MS).toISOString();
  return `${iso.slice(0, 10).replace(/-/g, ".")} ${iso.slice(11, 16)}`;
}

export async function testEliasRule(): Promise<boolean> {
  const snapshots = collectSnapshots();
  const history = groupById(snapshots);
  const everyRecruit = snapshots.flatMap(({ list }) => list);

  return runCases("elias 생성 규칙", [
    {
      name: "같은 ID의 title·postedBy·period·fields는 바뀌지 않음",
      run: () => {
        expectTrue(history.size > 0, "공고가 만들어지지 않음");
        for (const [id, versions] of history) {
          const [first] = versions;
          for (const { title, postedBy, period, fields } of versions) {
            expectEqual(
              { title, postedBy, period, fields },
              {
                title: first.title,
                postedBy: first.postedBy,
                period: first.period,
                fields: first.fields,
              },
              `${id}의 값이 바뀜`
            );
          }
        }
      },
    },
    {
      name: "status는 접수중 → 종료 한 번만 바뀜",
      run: () => {
        for (const [id, versions] of history) {
          const statuses = versions.map(({ status }) => status);
          const closedFrom = statuses.indexOf("종료");
          const open = closedFrom === -1 ? statuses : statuses.slice(0, closedFrom);
          const closed = closedFrom === -1 ? [] : statuses.slice(closedFrom);

          expectTrue(open.every((status) => status === "접수중"), `${id} 상태 오류`);
          expectTrue(closed.every((status) => status === "종료"), `${id}가 종료 뒤 바뀜`);
        }
      },
    },
    {
      name: "변경 감지의 updatedJobs는 종료로 바뀐 공고만 잡음",
      run: async () => {
        const { service } = createMemoryCache();
        const updated = await withMutedLogs(async () => {
          const ids: string[] = [];
          for (const { list } of snapshots) {
            const { diff } = await service.setRecruitList(list, "elias");
            for (const job of diff.updatedJobs) {
              expectEqual(job.value.source === "elias" && job.value.status, "종료");
              ids.push(job.id);
            }
          }
          return ids;
        });

        const closedIds = Array.from(history)
          .filter(([, versions]) => (
            versions[0].status === "접수중" && versions[versions.length - 1].status === "종료"
          ))
          .map(([id]) => id);

        expectTrue(updated.length > 0, "종료로 바뀐 공고가 한 건도 없음");
        expectEqual([...updated].sort(), [...closedIds].sort());
      },
    },
    {
      name: "모집 기간 끝 이후에는 목록에 없음",
      run: () => {
        for (const { tick, list } of snapshots) {
          for (const { id } of list) {
            const spawnedAt = spawnTick(id);
            expectTrue(spawnedAt <= tick, `${id}가 생성 전에 보임`);
            expectTrue(tick < spawnedAt + lifespanTicks, `${id}가 기간 뒤에도 남음`);
          }
        }
      },
    },
    {
      name: "같은 회차 공고끼리 제목+게시자가 겹치지 않음",
      run: () => {
        for (const { list } of snapshots) {
          const bySpawn = new Map<number, string[]>();
          for (const { id, title, postedBy } of list) {
            const spawnedAt = spawnTick(id);
            bySpawn.set(spawnedAt, [...(bySpawn.get(spawnedAt) ?? []), `${title}|${postedBy}`]);
          }
          for (const [spawnedAt, keys] of bySpawn) {
            expectEqual(new Set(keys).size, keys.length, `회차 ${spawnedAt}에 중복`);
          }
        }
      },
    },
    {
      name: "3건이 뽑힌 회차도 2건만 만들어짐",
      run: () => {
        expectTrue(everyRecruit.every(({ id }) => !id.endsWith("-2")), "세 번째 공고가 만들어짐");

        // 모든 회차가 3건을 뽑고 제거되지 않는 설정으로 확인한다
        const forced = {
          ...eliasConfig,
          spawnProbs: { 1: 0, 2: 0, 3: 1 },
          deleteProb: 0,
        };
        const tick = START_TICK + 100;
        const list = generateEliasRecruits(tick * unitMs, forced);

        expectEqual(list.length, lifespanTicks * eliasConfig.titles.length);
        expectTrue(list.every(({ id }) => !id.endsWith("-2")), "세 번째 공고가 만들어짐");
      },
    },
    {
      name: "제목의 지역이 elias 지역이고 게시자가 지역과 같음",
      run: () => {
        for (const { id, title, postedBy } of everyRecruit) {
          const region = /^\[([^\]]+)\] /.exec(title)?.[1];
          expectTrue(region && ELIAS_REGIONS.includes(region), `${id} 지역 오류: ${title}`);
          expectEqual(postedBy, region, `${id} 게시자 오류`);
        }
      },
    },
    {
      name: "period 모양과 시작·끝 값이 한국 시간과 같음",
      run: () => {
        for (const { id, period } of everyRecruit) {
          const spawnedAt = spawnTick(id);
          expectTrue(PERIOD_PATTERN.test(period), `${id} 기간 모양 오류: ${period}`);
          expectEqual(
            period,
            `${toKst(spawnedAt * unitMs)} ~ ${toKst((spawnedAt + lifespanTicks) * unitMs)}`
          );
        }
      },
    },
    {
      name: "같은 30분 안 다른 시각의 결과가 같음",
      run: () => {
        for (const { tick, list } of snapshots.filter((_, index) => index % 11 === 0)) {
          const start = tick * unitMs;
          expectEqual(generateEliasRecruits(start + 1, eliasConfig), list);
          expectEqual(generateEliasRecruits(start + unitMs - 1, eliasConfig), list);
        }
      },
    },
    {
      name: "하루 생성 수와 목록 평균이 예상 범위 안",
      run: () => {
        const spawned = Array.from(history.keys()).filter((id) => spawnTick(id) >= START_TICK);
        const perDay = spawned.length / DAYS;
        const average = everyRecruit.length / snapshots.length;
        console.log(`  하루 생성 ${perDay.toFixed(1)}건, 목록 평균 ${average.toFixed(1)}건`);

        expectTrue(perDay >= 30 && perDay <= 45, `하루 생성 수 범위 밖: ${perDay}`);
        expectTrue(average >= 8 && average <= 14, `목록 평균 범위 밖: ${average}`);
      },
    },
    {
      name: "틱 글자와 badge 칸이 없음",
      run: () => {
        const serialized = JSON.stringify(everyRecruit);
        expectTrue(!serialized.includes("틱"), "공고에 틱 글자가 있음");
        expectTrue(!serialized.includes("badge"), "공고에 badge 칸이 있음");
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testEliasRule());
}

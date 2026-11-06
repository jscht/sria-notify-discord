/**
 * `__test__` 공통 실행 도구.
 *
 * 항목을 차례로 실행해 통과·실패를 출력한다. 하나라도 실패하면 종료 코드가 1이 된다.
 */

import { deepStrictEqual, ok, rejects } from "node:assert";

export interface TestCase {
  name: string;
  run: () => void | Promise<void>;
}

/** 값이 같은지 확인한다. 객체와 배열은 내용을 비교한다. */
export function expectEqual(actual: unknown, expected: unknown, message?: string): void {
  deepStrictEqual(actual, expected, message);
}

/** 조건이 참인지 확인한다. */
export function expectTrue(condition: unknown, message: string): void {
  ok(condition, message);
}

/** 작업이 실패하는지 확인한다. */
export async function expectRejects(work: Promise<unknown>): Promise<void> {
  await rejects(work);
}

/** 주어진 시간(ms)만큼 기다린다. */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 반복이 많은 구간에서 정보·경고 로그를 끈다. 실패 출력을 찾기 쉽게 하기 위해서다. */
export async function withMutedLogs<T>(work: () => Promise<T>): Promise<T> {
  const { debug, info, warn } = console;
  const mute = () => {};
  console.debug = mute;
  console.info = mute;
  console.warn = mute;
  try {
    return await work();
  } finally {
    console.debug = debug;
    console.info = info;
    console.warn = warn;
  }
}

/**
 * 항목을 차례로 실행한다.
 *
 * @param title 출력할 테스트 이름
 * @param cases 실행할 항목
 * @returns 모두 통과하면 true
 */
export async function runCases(title: string, cases: TestCase[]): Promise<boolean> {
  console.log(`=== ${title} 시작 ===`);
  let failed = 0;

  for (const { name, run } of cases) {
    try {
      await run();
      console.log(`PASS: ${name}`);
    } catch (error) {
      failed++;
      console.log(`FAIL: ${name}`);
      console.error(error);
    }
  }

  console.log(`=== ${title} 완료: 통과 ${cases.length - failed} / ${cases.length} ===`);
  return failed === 0;
}

/**
 * 직접 실행한 테스트의 결과를 종료 코드에 반영한다.
 *
 * @param result 테스트 함수가 돌려준 결과
 */
export function reportResult(result: Promise<boolean>): void {
  result
    .then((passed) => {
      if (!passed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => {
      // 불러온 모듈이 연 핸들이 남아도 끝나게 한다. 남은 핸들이 없으면 이 타이머를 기다리지 않는다
      const exitTimer = setTimeout(() => process.exit(), 1000) as unknown as NodeJS.Timeout;
      exitTimer.unref();
    });
}

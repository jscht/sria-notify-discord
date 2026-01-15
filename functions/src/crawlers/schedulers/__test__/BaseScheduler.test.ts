/**
 * BaseScheduler Event Emit Test
 *
 * Phase 1.2 Completion Criteria:
 * - RECRUIT_CRAWL_STARTED event on scheduler start
 * - RECRUIT_CRAWL_COMPLETED event on work success
 * - RECRUIT_CRAWL_FAILED event on work failure
 */

// Register global logger (for test)
import "@/common/utils/systemLogger";

import { BaseScheduler } from "../base/BaseScheduler";
import { eventBus, EventType } from "@/events/eventBus";
import type {
  RecruitCrawlStartedEvent,
  RecruitCrawlCompletedEvent,
  RecruitCrawlFailedEvent,
} from "@/events/eventBus";
import type { SchedulerConfig, WorkResult } from "../types";

/**
 * Test scheduler for success case
 */
class SuccessScheduler extends BaseScheduler {
  constructor() {
    const config: SchedulerConfig = {
      name: "SuccessScheduler",
      workIntervalMs: 1000,
      logIntervalMs: 500,
    };
    super(config);
  }

  protected async performWork(): Promise<WorkResult> {
    const startTime = new Date();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const endTime = new Date();

    return {
      success: true,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      message: "Test work completed",
      totalCount: 10,
    };
  }
}

/**
 * Test scheduler for failure case
 */
class FailScheduler extends BaseScheduler {
  constructor() {
    const config: SchedulerConfig = {
      name: "FailScheduler",
      workIntervalMs: 1000,
      logIntervalMs: 500,
    };
    super(config);
  }

  protected async performWork(): Promise<WorkResult> {
    throw new Error("Intentional test error");
  }
}

/**
 * Run tests
 */
export async function testBaseSchedulerEvents(): Promise<void> {
  console.log("=== BaseScheduler Event Emit Test Start ===\n");

  // Event received flags
  let startedEvent: RecruitCrawlStartedEvent | null = null;
  let completedEvent: RecruitCrawlCompletedEvent | null = null;
  let failedEvent: RecruitCrawlFailedEvent | null = null;

  // 1. Register event listeners
  console.log("Test 1: Register event listeners");

  eventBus.onEvent<RecruitCrawlStartedEvent>(
    EventType.RECRUIT_CRAWL_STARTED,
    (payload) => {
      console.log("  STARTED event received:", payload.schedulerName);
      startedEvent = payload;
    }
  );

  eventBus.onEvent<RecruitCrawlCompletedEvent>(
    EventType.RECRUIT_CRAWL_COMPLETED,
    (payload) => {
      console.log("  COMPLETED event received:", payload.schedulerName);
      completedEvent = payload;
    }
  );

  eventBus.onEvent<RecruitCrawlFailedEvent>(
    EventType.RECRUIT_CRAWL_FAILED,
    (payload) => {
      console.log("  FAILED event received:", payload.schedulerName);
      failedEvent = payload;
    }
  );

  console.log("  Listeners registered\n");

  // 2. Success scheduler test
  console.log("Test 2: Success scheduler event emit");
  const successScheduler = new SuccessScheduler();
  successScheduler.startWork();

  await new Promise((resolve) => setTimeout(resolve, 200));
  successScheduler.stopWork();

  if (startedEvent) {
    const evt = startedEvent as RecruitCrawlStartedEvent;
    if (evt.schedulerName === "SuccessScheduler") {
      console.log("  PASS: STARTED event emitted");
      console.log(`     - timestamp: ${evt.timestamp}`);
      console.log(`     - schedulerName: ${evt.schedulerName}`);
    } else {
      console.log("  FAIL: STARTED event emit failed");
    }
  } else {
    console.log("  FAIL: STARTED event emit failed");
  }

  if (completedEvent) {
    const evt = completedEvent as RecruitCrawlCompletedEvent;
    if (evt.schedulerName === "SuccessScheduler") {
      console.log("  PASS: COMPLETED event emitted");
      console.log(`     - totalCount: ${evt.totalCount}`);
      console.log(`     - duration: ${evt.duration}ms`);
    } else {
      console.log("  FAIL: COMPLETED event emit failed");
    }
  } else {
    console.log("  FAIL: COMPLETED event emit failed");
  }

  // Payload structure validation (Test 4)
  console.log("\nTest 4: Payload structure validation");
  if (completedEvent) {
    const evt = completedEvent as RecruitCrawlCompletedEvent;
    const hasValidStructure =
      typeof evt.timestamp === "number" &&
      typeof evt.schedulerName === "string" &&
      typeof evt.totalCount === "number" &&
      typeof evt.duration === "number";

    if (hasValidStructure) {
      console.log("  PASS: COMPLETED event payload structure valid");
    } else {
      console.log("  FAIL: COMPLETED event payload structure invalid");
    }
  } else {
    console.log("  FAIL: COMPLETED event payload structure invalid (no event)");
  }

  // Reset
  startedEvent = null;
  completedEvent = null;

  // 3. Fail scheduler test
  console.log("\nTest 3: Fail scheduler event emit");
  const failScheduler = new FailScheduler();
  failScheduler.startWork();

  await new Promise((resolve) => setTimeout(resolve, 200));
  failScheduler.stopWork();

  if (startedEvent) {
    const evt = startedEvent as RecruitCrawlStartedEvent;
    if (evt.schedulerName === "FailScheduler") {
      console.log("  PASS: STARTED event emitted");
    } else {
      console.log("  FAIL: STARTED event emit failed");
    }
  } else {
    console.log("  FAIL: STARTED event emit failed");
  }

  if (failedEvent) {
    const evt = failedEvent as RecruitCrawlFailedEvent;
    if (evt.schedulerName === "FailScheduler") {
      console.log("  PASS: FAILED event emitted");
      console.log(`     - error: ${evt.error.message}`);
      console.log(`     - duration: ${evt.duration}ms`);
    } else {
      console.log("  FAIL: FAILED event emit failed");
    }
  } else {
    console.log("  FAIL: FAILED event emit failed");
  }

  // Cleanup listeners
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_CRAWL_STARTED);
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_CRAWL_COMPLETED);
  eventBus.removeAllListenersForEvent(EventType.RECRUIT_CRAWL_FAILED);

  console.log("\n=== BaseScheduler Event Emit Test Complete ===\n");
}

// Direct execution
if (require.main === module) {
  testBaseSchedulerEvents().catch(console.error);
}
